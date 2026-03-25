const { spawn } = require('child_process');
const path = require('path');

const projectDir = 'd:\\PROJETS_AI\\ETS-COUL&FRERES-TECH';
const vite = path.join(projectDir, 'node_modules', '.bin', 'vite.cmd');

const child = spawn(vite, ['--port', '3000', '--host'], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: false
});

child.on('error', (err) => console.error('Failed:', err));
child.on('exit', (code) => console.log('Exit:', code));
