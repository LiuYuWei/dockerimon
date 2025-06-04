
import { NextResponse } from 'next/server';
import { exec, type ExecException } from 'child_process';

// Define a more specific type for the expected request body
interface VolumeActionRequest {
  action: 'remove'; // Currently only remove is supported for volumes via this simple API
}

export async function POST(
  request: Request,
  { params }: { params: { volumeName: string } }
) {
  const { volumeName } = params;

  if (!volumeName) {
    return NextResponse.json({ error: "Volume name is required" }, { status: 400 });
  }

  let reqBody: VolumeActionRequest;
  try {
    reqBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = reqBody;

  if (!action || action !== 'remove') {
    return NextResponse.json({ error: "Invalid action. Only 'remove' is supported for volumes." }, { status: 400 });
  }

  let command: string;
  switch (action) {
    case 'remove':
      // Using --force to remove volumes even if in use, be cautious.
      // Remove --force if you want to prevent deletion of volumes used by containers.
      command = `docker volume rm ${volumeName.trim()}`; 
      break;
    default:
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  }

  return new Promise((resolve) => {
    exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
      if (error) {
        console.error(`Error executing Docker command for volume ${volumeName} (${action}):`, stderr);
        let errorMessage = `Failed to ${action} volume ${volumeName}.`;
        if (stderr) {
          if (stderr.toLowerCase().includes("no such volume")) {
            errorMessage = `Volume ${volumeName} not found.`;
          } else if (stderr.toLowerCase().includes("volume is in use")) {
            errorMessage = `Volume ${volumeName} is currently in use by a container. Stop the container first or use force remove.`;
          } else {
            errorMessage = `Docker command failed: ${stderr.trim()}`;
          }
        }
        resolve(NextResponse.json({ error: errorMessage, details: stderr.trim() }, { status: 500 }));
        return;
      }
      resolve(NextResponse.json({ message: `Volume ${volumeName} ${action} successful`, details: stdout.trim() }));
    });
  });
}
