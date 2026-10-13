import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { updateJobStatus } from "@/lib/store";
import type { Status } from "@/lib/types";

const validStatuses: Status[] = ["new", "saved", "applied", "rejected"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isRequestAuthenticated(request.headers)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const { status } = body;

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const success = await updateJobStatus(id, status);
    if (!success) {
      return NextResponse.json({ error: "Failed to update job status" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id, status });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to process request: ${(error as Error).message}` },
      { status: 400 }
    );
  }
}
