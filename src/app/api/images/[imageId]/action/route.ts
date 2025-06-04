
import { NextResponse } from 'next/server';
import { exec, type ExecException } from 'child_process';

// Define a more specific type for the expected request body
interface ImageActionRequest {
  action: 'remove'; // Currently only remove is supported for images
}

export async function POST(
  request: Request,
  { params }: { params: { imageId: string } }
) {
  const { imageId } = params;

  if (!imageId) {
    return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
  }

  let reqBody: ImageActionRequest;
  try {
    reqBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = reqBody;

  if (!action || action !== 'remove') {
    return NextResponse.json({ error: "Invalid action. Only 'remove' is supported for images." }, { status: 400 });
  }

  let command: string;
  switch (action) {
    case 'remove':
      command = `docker rmi ${imageId.trim()}`; // Add -f to force if needed: `docker rmi -f ${imageId}`
      break;
    default:
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  }

  return new Promise((resolve) => {
    exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
      if (error) {
        console.error(`Error executing Docker command for image ${imageId} (${action}):`, stderr);
        let errorMessage = `Failed to ${action} image ${imageId.substring(0,12)}.`;
        if (stderr) {
          if (stderr.toLowerCase().includes("no such image")) {
            errorMessage = `Image ${imageId.substring(0,12)} not found.`;
          } else if (stderr.toLowerCase().includes("image is referenced in a running container")) {
            errorMessage = `Image ${imageId.substring(0,12)} is in use by a running container. Stop or remove the container first.`;
          } else if (stderr.toLowerCase().includes("image is referenced in a stopped container")) {
             errorMessage = `Image ${imageId.substring(0,12)} is in use by a stopped container. Remove the container first (or use force remove).`;
          } else if (stderr.toLowerCase().includes("conflict: unable to delete") || stderr.toLowerCase().includes("image has dependent child images")) {
             errorMessage = `Cannot remove image ${imageId.substring(0,12)}: it has dependent child images or is part of a manifest list.`;
          }
           else {
            errorMessage = `Docker command failed: ${stderr.trim()}`;
          }
        }
        resolve(NextResponse.json({ error: errorMessage, details: stderr.trim() }, { status: 500 }));
        return;
      }
      resolve(NextResponse.json({ message: `Image ${imageId.substring(0,12)} ${action} successful`, details: stdout.trim() }));
    });
  });
}
