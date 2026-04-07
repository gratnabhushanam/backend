const fs = require('fs');
const { spawn } = require('child_process');
const ffprobe = require('ffprobe-static');

const getVideoDurationSeconds = (filePath) => new Promise((resolve, reject) => {
  if (!filePath || !fs.existsSync(filePath)) {
    reject(new Error('Video file not found'));
    return;
  }

  const probeProcess = spawn(ffprobe.path, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  let output = '';
  let errorOutput = '';

  probeProcess.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });

  probeProcess.stderr.on('data', (chunk) => {
    errorOutput += chunk.toString();
  });

  probeProcess.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(errorOutput || 'Unable to probe video duration'));
      return;
    }

    const duration = Number(String(output).trim());
    if (!Number.isFinite(duration)) {
      reject(new Error('Invalid video duration metadata'));
      return;
    }

    resolve(duration);
  });
});

module.exports = {
  getVideoDurationSeconds,
};
