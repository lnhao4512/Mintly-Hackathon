import { NextRequest, NextResponse } from "next/server";
import { recordSale, getAllSales, getSalesForWallet } from "@/lib/db/sales";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const sales = wallet ? await getSalesForWallet(wallet) : await getAllSales();
  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.mintAddress || !body?.seller || !body?.buyer) {
    return NextResponse.json({ error: "mintAddress, seller and buyer are required" }, { status: 400 });
  }
  await recordSale(body);
  return NextResponse.json({ ok: true });
}
