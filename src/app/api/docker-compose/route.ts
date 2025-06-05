
import { NextResponse } from 'next/server';
import { exec, type ExecException } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';

interface DockerComposeRequest {
  actionType: 'up' | 'down';
  composeYaml: string;
}

export async function POST(request: Request) {
  let tempFilePath = '';
  try {
    const reqBody: DockerComposeRequest = await request.json();
    const { actionType, composeYaml } = reqBody;

    if (!actionType || !['up', 'down'].includes(actionType)) {
      return NextResponse.json({ error: "Invalid actionType. Must be 'up' or 'down'." }, { status: 400 });
    }
    if (!composeYaml || typeof composeYaml !== 'string' || !composeYaml.trim()) {
      return NextResponse.json({ error: "composeYaml content is required." }, { status: 400 });
    }

    // Create a unique temporary file name
    const uniqueSuffix = randomBytes(8).toString('hex');
    const tempFileName = `docker-compose-temp-${uniqueSuffix}.yaml`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);

    await fs.writeFile(tempFilePath, composeYaml, 'utf8');

    let command: string;
    if (actionType === 'up') {
      command = `docker-compose -f "${tempFilePath}" up -d`;
    } else { // actionType === 'down'
      command = `docker-compose -f "${tempFilePath}" down`;
    }

    return new Promise((resolve) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error: ExecException | null, stdout: string, stderr: string) => { // Increased maxBuffer
        // Attempt to clean up the file regardless of command outcome
        fs.unlink(tempFilePath).catch(cleanupError => {
          console.warn(`Failed to cleanup temporary compose file '${tempFilePath}':`, cleanupError);
        });
        tempFilePath = ''; // Clear path after attempted deletion

        if (error) {
          console.error(`Error executing command [${command}]:`, stderr, error.message);
          resolve(NextResponse.json({
            success: false,
            output: stdout.trim(), // Still send stdout
            error: `Command execution failed: ${stderr.trim() || error.message}`
          }, { status: 500 }));
          return;
        }
        resolve(NextResponse.json({
          success: true,
          output: (stdout.trim() + (stderr.trim() ? `\n--- STDERR ---\n${stderr.trim()}` : '')).trim()
        }));
      });
    });

  } catch (e: any) {
    console.error("Unhandled error in docker-compose API:", e);
    // If tempFilePath was set and an error occurred before or during exec promise, try to clean up
    if (tempFilePath) {
      fs.unlink(tempFilePath).catch(cleanupError => {
        console.warn(`Failed to cleanup temporary compose file '${tempFilePath}' after outer error:`, cleanupError);
      });
    }
    return NextResponse.json({ error: "An unexpected server error occurred.", details: e.message || String(e) }, { status: 500 });
  }
}
