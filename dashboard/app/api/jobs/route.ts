import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { fetchJobs } from "@/lib/store";

export async function GET(request: Request) {
  if (!isRequestAuthenticated(request.headers)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const jobs = await fetchJobs();
    return NextResponse.json({ jobs, total: jobs.length });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to load jobs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
