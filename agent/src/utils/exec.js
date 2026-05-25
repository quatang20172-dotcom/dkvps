/**
 * Command execution utility
 */
const { exec } = require('child_process');

function run(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error && error.killed) return reject(new Error('Command timed out'));
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: error ? error.code : 0 });
        });
    });
}

function runSafe(command, timeout = 30000) {
    return run(command, timeout).catch(e => ({ stdout: '', stderr: e.message, code: 1 }));
}

module.exports = { run, runSafe };
