import { NextRequest, NextResponse } from "next/server";

const UPLIFT_AI_API_KEY = process.env.UPLIFT_AI_API_KEY;

/**
 * Transcribe Urdu audio to text using Uplift AI
 */
export async function POST(req: NextRequest) {
  try {
    // Debug: Log environment variable status (without exposing the key)
    console.log("UPLIFT_AI_API_KEY exists:", !!UPLIFT_AI_API_KEY);
    console.log("UPLIFT_AI_API_KEY length:", UPLIFT_AI_API_KEY?.length || 0);
    
    if (!UPLIFT_AI_API_KEY) {
      console.error("UPLIFT_AI_API_KEY is missing from environment variables");
      return NextResponse.json(
        { 
          error: "UPLIFT_AI_API_KEY not configured",
          hint: "Make sure UPLIFT_AI_API_KEY is in .env.local and restart the dev server"
        },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("file") as File;
    const model = (formData.get("model") as string) || "scribe";
    const language = (formData.get("language") as string) || "ur";
    const domain = (formData.get("domain") as string) || "phone-commerce";

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 },
      );
    }

    // Log file details for debugging
    console.log("Audio file details:", {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
      lastModified: audioFile.lastModified,
    });

    // Check file size (max 25MB as per Uplift AI docs)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large. Maximum size is 25MB." },
        { status: 400 },
      );
    }

    // Check if file is empty
    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio file is empty. Please record some audio." },
        { status: 400 },
      );
    }

    // Create form data for Uplift AI (matching their documentation format)
    const upliftFormData = new FormData();
    
    // Append file - use the File object directly as per their docs
    upliftFormData.append("file", audioFile);
    upliftFormData.append("model", model);
    upliftFormData.append("language", language);
    upliftFormData.append("domain", domain);
    
    console.log("Sending to Uplift AI:", {
      model,
      language,
      domain,
      fileSize: audioFile.size,
      fileType: audioFile.type,
    });

    // Call Uplift AI API
    const response = await fetch(
      "https://api.upliftai.org/v1/transcribe/speech-to-text",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPLIFT_AI_API_KEY}`,
        },
        body: upliftFormData,
      },
    );

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      
      console.error("Uplift AI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Provide more helpful error messages
      let errorMessage = `Uplift AI API error: ${response.status} ${response.statusText}`;
      if (typeof errorData === 'object' && errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          details: errorData,
          hint: response.status === 500 
            ? "The audio format might not be supported. Try recording again or use a different format."
            : "Check your API key and audio file format.",
        },
        { status: response.status },
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error("Failed to parse Uplift AI response:", text);
      return NextResponse.json(
        {
          error: "Invalid response from Uplift AI",
          details: text,
        },
        { status: 500 },
      );
    }

    console.log("Uplift AI response:", data);

    // Uplift AI returns 'transcript' not 'text'
    const transcribedText = data.text || data.transcript || "";
    
    if (!transcribedText) {
      console.warn("Uplift AI response missing text/transcript field:", data);
      return NextResponse.json(
        {
          error: "Transcription response missing text field",
          raw: data,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      text: transcribedText,
      raw: data,
    });
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

