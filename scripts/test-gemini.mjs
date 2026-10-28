import { readFileSync } from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith("GEMINI_API_KEY=")) continue;
      let v = line.slice("GEMINI_API_KEY=".length).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env.GEMINI_API_KEY = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();
const k = process.env.GEMINI_API_KEY;
console.log("key_present", Boolean(k));
console.log("key_shape", k ? (k.startsWith("AIza") ? "AIza" : k.slice(0, 3)) : "none");

const listRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`,
);
if (listRes.ok) {
  const json = await listRes.json();
  const names = (json.models ?? [])
    .map((m) => m.name?.replace("models/", ""))
    .filter((n) => n?.includes("gemini"))
    .slice(0, 12);
  console.log("available_models_sample", names.join(", "));
} else {
  console.log("list_models_fail", listRes.status, await listRes.text().then((t) => t.slice(0, 120)));
}

const models = [
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

for (const name of models) {
  try {
    const genAI = new GoogleGenerativeAI(k);
    const model = genAI.getGenerativeModel({
      model: name,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent('Say {"ok":true}');
    console.log(name, "OK", result.response.text().slice(0, 80));
    break;
  } catch (e) {
    console.log(name, "FAIL", e.message?.slice(0, 200));
    if (e.status) console.log("  status", e.status);
  }
}
