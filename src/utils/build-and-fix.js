const { execSync } = require('child_process');

const steps = [
    { cmd: 'node src/fix/cleanup/cleanup-models.js', name: '🧹 Cleaning Models' },
    { cmd: 'node src/fix/cleanup/cleanup-ui.js', name: '🧹 Cleaning UI' },
    { cmd: 'node src/fix/fix-scaffold-enhanced.js', name: '🛠️ Fixing Scaffolding' },
    { cmd: 'node run_build_proxy.js', name: '🔨 Building Project' }
];

for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    try {
        // Inherit stdio to see output in real-time
        execSync(step.cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Step failed: ${step.name}`);
        // Stop execution if build fails or fix fails
        if ( step.name !== 'Cleaning Models' && step.name !== 'Cleaning UI') {
             process.exit(1);
        }
    }
}
console.log('\n✅ All steps completed!');
