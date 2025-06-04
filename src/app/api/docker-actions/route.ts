
import { NextResponse } from 'next/server';
import { exec, type ExecException } from 'child_process';

interface DockerActionRequest {
  actionType: 'pull' | 'run';
  payload: string; // For pull: image_name, For run: arguments string
}

export async function POST(request: Request) {
  try {
    const reqBody: DockerActionRequest = await request.json();
    const { actionType, payload } = reqBody;

    if (!actionType || !payload) {
      return NextResponse.json({ error: "Action type and payload are required." }, { status: 400 });
    }

    let command: string;
    const safePayload = payload.trim(); // Basic sanitization

    if (actionType === 'pull') {
      if (!safePayload.match(/^[a-zA-Z0-9\-_/:.]+$/)) { // Basic validation for image name
          return NextResponse.json({ error: "Invalid image name format for pull." }, { status: 400 });
      }
      command = `docker pull ${safePayload}`;
    } else if (actionType === 'run') {
      // For 'run', payload contains arguments. We are trusting the user's input for their local machine.
      // Avoid complex validation here as 'docker run' arguments can be very diverse.
      command = `docker run ${safePayload}`;
    } else {
      return NextResponse.json({ error: `Invalid action type: ${actionType}` }, { status: 400 });
    }

    return new Promise((resolve) => {
      exec(command, { maxBuffer: 1024 * 1024 * 5 }, (error: ExecException | null, stdout: string, stderr: string) => { // Increased maxBuffer
        if (error) {
          // Docker commands often use stderr for informational messages even on success (e.g., pull progress)
          // So, an error object here usually means the command itself failed to execute or Docker daemon error
          console.error(`Error executing command [${command}]:`, stderr, error.message);
          resolve(NextResponse.json({ 
            success: false, 
            output: stdout.trim(), // Still send stdout
            error: `Command execution failed: ${stderr.trim() || error.message}` 
          }, { status: 500 }));
          return;
        }
        // If exec error is null, the command likely initiated. stderr might contain Docker-specific errors or progress.
        resolve(NextResponse.json({ 
          success: true, 
          output: (stdout.trim() + (stderr.trim() ? `\n--- STDERR ---\n${stderr.trim()}` : '')).trim() 
        }));
      });
    });

  } catch (e: any) {
    console.error("Unhandled error in docker-actions API:", e);
    return NextResponse.json({ error: "An unexpected server error occurred.", details: e.message || String(e) }, { status: 500 });
  }
}
