import { NextResponse } from "next/server";
import { classifyChatIntent } from "@/lib/chat-intent";
import { getCategoryLabel } from "@/lib/categories";
import { resolveCategory } from "@/lib/classify-expense";
import { fetchAllExpensesForStats } from "@/lib/fetch-all-expenses";
import {
  buildAnalysisPrompt,
  formatSavedMessage,
  isValidExpense,
  parseExpenseAnalysis,
  todayISO,
  type ChatMessageInput,
} from "@/lib/gemini-expense";
import {
  buildStatsAnswerPrompt,
  formatExpensesForStats,
} from "@/lib/gemini-stats";
import {
  generateJsonWithFallback,
  generateTextWithFallback,
  mapGeminiError,
} from "@/lib/gemini-client";
import { EXPENSE_SELECT } from "@/lib/supabase/client";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI 서비스 설정이 완료되지 않았습니다. GEMINI_API_KEY를 확인해 주세요.",
      },
      { status: 500 },
    );
  }

  let body: { messages?: ChatMessageInput[]; sortMode?: "date" | "manual" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const messages = body.messages?.filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content?.trim(),
  );
  if (!messages?.length) {
    return NextResponse.json({ error: "메시지가 없습니다." }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return NextResponse.json(
      { error: "사용자 메시지가 필요합니다." },
      { status: 400 },
    );
  }

  const auth = await requireUser();
  if (isAuthError(auth)) return auth;
  const { supabase, user } = auth;

  const intent = classifyChatIntent(last.content);

  if (intent === "stats") {
    try {
      const { rows, error: allError } =
        await fetchAllExpensesForStats(supabase);
      if (allError) {
        return NextResponse.json(
          { error: "지출 내역을 불러오지 못했습니다." },
          { status: 500 },
        );
      }

      const table = formatExpensesForStats(rows);
      const prompt = buildStatsAnswerPrompt(
        todayISO(),
        table,
        rows.length,
        messages,
      );
      const reply = await generateTextWithFallback(apiKey, prompt);

      return NextResponse.json({
        reply: reply || "답변을 만들지 못했어요. 다시 질문해 주세요.",
        statsAnswer: true,
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[api] Gemini stats error:", err);
      }
      return NextResponse.json(
        { error: mapGeminiError(err) },
        { status: 502 },
      );
    }
  }

  const { data: expenses, error: fetchError } = await supabase
    .from("expenses")
    .select("date, amount, description")
    .order("created_at", { ascending: false })
    .limit(8);

  if (fetchError) {
    return NextResponse.json(
      { error: "지출 내역을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  const recentSummary =
    expenses
      ?.map((e) => `- ${e.date} | ${e.amount}원 | ${e.description}`)
      .join("\n") ?? "";

  try {
    const prompt = buildAnalysisPrompt(todayISO(), recentSummary, messages);
    const raw = await generateJsonWithFallback(apiKey, prompt);
    const analysis = parseExpenseAnalysis(raw);

    if (!analysis) {
      return NextResponse.json({
        reply:
          "지출 내용을 이해하지 못했습니다. 날짜, 금액, 사용 내용을 함께 알려 주세요.",
        extracted: null,
      });
    }

    if (analysis.action === "need_info" || analysis.action === "conversation") {
      return NextResponse.json({
        reply: analysis.reply,
        extracted: {
          date: analysis.date,
          amount: analysis.amount,
          description: analysis.description,
        },
      });
    }

    if (!isValidExpense(analysis)) {
      return NextResponse.json({
        reply:
          analysis.reply ||
          "날짜와 금액을 정확히 알려 주시겠어요? 예: \"어제 택시 2만원\"",
        extracted: {
          date: analysis.date,
          amount: analysis.amount,
          description: analysis.description,
        },
      });
    }

    const note = analysis.note?.trim() ?? "";
    const classified = resolveCategory(
      analysis.description,
      note,
      analysis.category_code,
    );

    let sortOrder: number | null = null;
    if (body.sortMode === "manual") {
      const monthPrefix = analysis.date.slice(0, 7);
      const { data: monthRows } = await supabase
        .from("expenses")
        .select("sort_order")
        .gte("date", `${monthPrefix}-01`)
        .lte("date", `${monthPrefix}-31`);
      const orders = (monthRows ?? [])
        .map((r) => r.sort_order)
        .filter((v): v is number => typeof v === "number");
      const minOrder = orders.length ? Math.min(...orders) : 0;
      sortOrder = minOrder - 1;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        date: analysis.date,
        amount: analysis.amount,
        description: analysis.description.trim(),
        note,
        category_code: classified.code,
        category_needs_review: classified.needsReview,
        category_user_set: false,
        sort_order: sortOrder,
      })
      .select(EXPENSE_SELECT)
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({
        reply:
          "지출 정보는 파악했지만 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        extracted: {
          date: analysis.date,
          amount: analysis.amount,
          description: analysis.description,
        },
      });
    }

    const reply = formatSavedMessage(
      analysis.date,
      analysis.description,
      analysis.amount,
      getCategoryLabel(classified.code),
      classified.needsReview,
    );

    return NextResponse.json({
      reply,
      expenseSaved: true,
      expense: inserted,
      extracted: {
        date: analysis.date,
        amount: analysis.amount,
        description: analysis.description,
        category_code: classified.code,
        category_needs_review: classified.needsReview,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[api] Gemini error:", err);
    }
    return NextResponse.json(
      { error: mapGeminiError(err) },
      { status: 502 },
    );
  }
}
