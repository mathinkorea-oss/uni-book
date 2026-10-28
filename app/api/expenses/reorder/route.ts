import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/supabase/route-auth";

type ReorderItem = { id: string; sort_order: number };

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth;

  let body: { items?: ReorderItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const items = body.items?.filter(
    (i) => i.id && typeof i.sort_order === "number",
  );
  if (!items?.length) {
    return NextResponse.json({ error: "순서 데이터가 없습니다." }, { status: 400 });
  }

  const { supabase } = auth;
  const payload = items.map((i) => ({
    id: i.id,
    sort_order: i.sort_order,
  }));

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "reorder_expenses_batch",
    { updates: payload },
  );

  if (!rpcError) {
    const updated =
      rpcData &&
      typeof rpcData === "object" &&
      "updated" in rpcData &&
      typeof (rpcData as { updated: unknown }).updated === "number"
        ? (rpcData as { updated: number }).updated
        : null;
    if (updated !== items.length) {
      return NextResponse.json(
        {
          error:
            "순서를 저장하지 못했습니다. 내 기록만 정렬할 수 있습니다.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, updated });
  }

  const snapshot: ReorderItem[] = [];
  for (const item of items) {
    const { data: before } = await supabase
      .from("expenses")
      .select("sort_order")
      .eq("id", item.id)
      .single();
    if (before) {
      snapshot.push({ id: item.id, sort_order: before.sort_order ?? 0 });
    }

    const { data: updated, error } = await supabase
      .from("expenses")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id)
      .select("id");

    if (error || !updated?.length) {
      for (const prev of snapshot) {
        await supabase
          .from("expenses")
          .update({ sort_order: prev.sort_order })
          .eq("id", prev.id);
      }
      return NextResponse.json(
        { error: "순서를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
