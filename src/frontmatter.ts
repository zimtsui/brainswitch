import { spawnSync } from 'node:child_process';


export function prepend(metadata: object): string {
    const frontmatterResult = spawnSync(
        'cat | pandoc --wrap=none --standalone -f markdown -t markdown --metadata-file=<(cat) /dev/null',
        { shell: '/usr/bin/bash', input: JSON.stringify(metadata), encoding: 'utf-8' },
    );
    if (frontmatterResult.status) throw new prepend.SyntaxError(frontmatterResult.stderr);
    return frontmatterResult.stdout;
}
export namespace prepend {
    export class SyntaxError extends globalThis.SyntaxError {}
}
