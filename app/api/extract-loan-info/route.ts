import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schema for loan information extraction
// Note: OpenAI structured outputs require .nullable() instead of .optional()
const LoanInfo = z.object({
  partnerName: z.string().nullable().describe("Name of the partner/borrower mentioned in the text"),
  loanAmount: z.number().nullable().describe("Loan amount in PKR (extract the number only)"),
  description: z.string().nullable().describe("Description or reason for the loan"),
  loanDate: z.string().nullable().describe("Date when loan was given (format: YYYY-MM-DD or relative like 'today', 'yesterday')"),
  expectedReturnDate: z.string().nullable().describe("Expected return date (format: YYYY-MM-DD or relative like 'next week', 'in 10 days')"),
});

/**
 * Extract loan information from Urdu transcribed text using OpenAI
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      );
    }

    console.log("Extracting loan info from text:", text);

    const response = await openai.responses.parse({
      model: "gpt-4.1-2025-04-14",
      input: [
        {
          role: "system",
          content: `You are an expert at extracting loan information from Urdu text. Extract the following information:
- Partner/Borrower name (the person receiving the loan)
- Loan amount in PKR (extract only the number)
- Description (reason or details about the loan)
- Loan date (when the loan was given - convert to YYYY-MM-DD format if possible)
- Expected return date (when the loan should be returned - convert to YYYY-MM-DD format if possible)

If any information is missing, leave it as null or empty. Return dates in YYYY-MM-DD format.`,
        },
        {
          role: "user",
          content: `Extract loan information from this Urdu text: ${text}`,
        },
      ],
      text: {
        format: zodTextFormat(LoanInfo, "loanInfo"),
      },
    });

    const loanInfo = response.output_parsed;

    console.log("Extracted loan info:", loanInfo);

    return NextResponse.json({
      success: true,
      loanInfo: loanInfo,
      raw: response,
    });
  } catch (error: any) {
    console.error("Error extracting loan info:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        details: error,
      },
      { status: 500 },
    );
  }
}

