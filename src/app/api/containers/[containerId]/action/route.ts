
import { NextResponse } from 'next/server';
import { exec, type ExecException } from 'child_process';

// Define a more specific type for the expected request body
interface ContainerActionRequest {
  action: 'start' | 'stop' | 'restart' | 'remove';
  force?: boolean; // Added for force remove
}

export async function POST(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try { // Outer try-catch for the whole handler
    const { containerId } = params;

    if (!containerId) {
      return NextResponse.json({ error: "Container ID is required" }, { status: 400 });
    }

    let reqBody: ContainerActionRequest;
    try {
      reqBody = await request.json();
    } catch (e) {
      console.error("Failed to parse request JSON body:", e);
      return NextResponse.json({ error: "Invalid JSON body. Please ensure you are sending a valid JSON object." }, { status: 400 });
    }

    const { action, force } = reqBody;

    // Validate action
    if (!['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}. Supported actions are start, stop, restart, remove.` }, { status: 400 });
    }

    let command: string;
    const safeContainerId = containerId.trim(); // Basic trim

    switch (action) {
      case 'start':
        command = `docker start ${safeContainerId}`;
        break;
      case 'stop':
        command = `docker stop ${safeContainerId}`;
        break;
      case 'restart':
        command = `docker restart ${safeContainerId}`;
        break;
      case 'remove':
        command = `docker rm ${force ? '-f ' : ''}${safeContainerId}`;
        break;
      default:
        // This case should not be reached due to the validation above
        return NextResponse.json({ error: `Unexpected action: ${action}` }, { status: 400 });
    }

    // Using a Promise to handle the async nature of exec
    return new Promise((resolve) => {
      exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error executing Docker command [${command}] for container ${safeContainerId}:`, stderr, error.message);
          let errorMessage = `Failed to ${action} container ${safeContainerId.substring(0,12)}.`;

          if (stderr) {
              const lowerStderr = stderr.toLowerCase();
              if (lowerStderr.includes('no such container')) {
                errorMessage = `Container ${safeContainerId.substring(0,12)} not found.`;
              } else if (lowerStderr.includes('container is not running') && (action === 'stop' || action === 'restart')) {
                // Docker might say "Error response from daemon: Container xxx is not running" for stop/restart
                errorMessage = `Container ${safeContainerId.substring(0,12)} is already stopped or does not exist.`;
              } else if (lowerStderr.includes('container is already stopped') && action === 'stop') {
                errorMessage = `Container ${safeContainerId.substring(0,12)} is already stopped.`;
              } else if (lowerStderr.includes('is already started') && action === 'start') {
                errorMessage = `Container ${safeContainerId.substring(0,12)} is already running.`;
              } else if (lowerStderr.includes("you cannot remove a running container") && action === 'remove' && !force) {
                  errorMessage = `Cannot remove running container ${safeContainerId.substring(0,12)}. Stop it first or use force remove.`;
              } else if (lowerStderr.includes("conflict") && (lowerStderr.includes("unable to remove") || lowerStderr.includes("in use"))){
                   errorMessage = `Cannot remove container ${safeContainerId.substring(0,12)}: it might be in use or have dependencies. Try force remove if applicable.`;
              }
               else {
                // Capture more generic Docker errors
                errorMessage = `Docker command failed: ${stderr.trim() || error.message}`;
              }
          } else if (error && error.message) {
              // Fallback to error.message if stderr is empty
              errorMessage = `Docker command execution failed: ${error.message}`;
          }
          
          resolve(NextResponse.json({ error: errorMessage, details: stderr.trim() || (error ? error.message : '') }, { status: 500 }));
          return;
        }
        resolve(NextResponse.json({ message: `Container ${action}${force ? ' (forced)' : ''} successful for ${safeContainerId.substring(0,12)}`, details: stdout.trim() }));
      });
    });
  } catch (e: any) { // Catch any synchronous errors in the handler
    console.error("Unhandled error in container action API:", e);
    return NextResponse.json({ error: "An unexpected server error occurred.", details: e.message || String(e) }, { status: 500 });
  }
}
