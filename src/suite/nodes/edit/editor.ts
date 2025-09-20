import { lexer } from 'marked';


export class Editor {
	private history: string[];
	private located = new Set<number>([0]);
	public finalChecked = false;

	public constructor(text: string) {
		this.history = [text];
	}

	private static notLocated(offset: number): string {
		return `操作失败，字符位置 ${offset} 未被精确定位或定位已失效，请先 \`read\` 或 \`find\` 以 ${offset} 为端点的区间。`;
	}

	public headings(): string {
		const tokens = lexer(this.getText());
		return tokens
			.filter(token => token.type === 'heading')
			.map(token => token.raw)
			.join('')
			.split('\n')
			.filter(line => line)
			.join('\n');
	}

	public getText(): string {
		return this.history.at(-1)!;
	}

	public view(): string {
		this.finalChecked = true;
		return this.getText();
	}

	public read(begin: number, end: number): string {
		const text = this.getText();
		this.located.add(begin);
		this.located.add(end);
		if (end > text.length) return '读取失败，结束位置超出了全文的长度。';
		return text.slice(begin, end);
	}

	public size(): string {
		const text = this.getText();
		this.located.add(text.length);
		return String(text.length);
	}

	public splice(fragment: string, begin: number, end: number): string {
		const text = this.getText();
		if (this.located.has(begin)) {} else return Editor.notLocated(begin);
		if (this.located.has(end)) {} else return Editor.notLocated(end);

		const newText = text.slice(0, begin) + fragment + text.slice(end);

		this.history.push(newText);
		this.located = new Set([...this.located].filter(i => i <= begin));
		this.finalChecked = false;
		return '替换成功，你的编辑规划中的部分字符位置已失效。';
	}

	public copy(destOffset: number, srcBegin: number, srcEnd: number): string {
		const text = this.getText();
		if (this.located.has(srcBegin)) {} else return Editor.notLocated(srcBegin);
		if (this.located.has(srcEnd)) {} else return Editor.notLocated(srcEnd);
		if (this.located.has(destOffset)) {} else return Editor.notLocated(destOffset);

		const newText = text.slice(0, destOffset) + text.slice(srcBegin, srcEnd) + text.slice(destOffset);

		this.history.push(newText);
		this.located = new Set([...this.located].filter(i => i <= destOffset));
		this.finalChecked = false;
		return '复制成功，你的编辑规划中的部分字符位置已失效。';
	}

	private rotate(text: string, begin: number, mid: number, end: number): string {
		return text.slice(0, begin) + text.slice(mid, end) + text.slice(begin, mid) + text.slice(end);
	}

	public move(destOffset: number, srcBegin: number, srcEnd: number): string {
		const text = this.getText();
		if (this.located.has(srcBegin)) {} else return Editor.notLocated(srcBegin);
		if (this.located.has(srcEnd)) {} else return Editor.notLocated(srcEnd);
		if (this.located.has(destOffset)) {} else return Editor.notLocated(destOffset);

		if (srcBegin <= destOffset && destOffset <= srcBegin + srcEnd) {
			this.history.push(text);
			return '移动失败，目标位置等于原位置。';
		} else if (destOffset < srcBegin) {
			const begin = destOffset, mid = srcBegin, end = srcEnd;
			const newText = this.rotate(text, begin, mid, end);

			this.history.push(newText);
			this.located = new Set([...this.located].filter(i => i <= begin || i >= end));
			this.finalChecked = false;
			return '移动成功，你的编辑规划中的部分字符位置已失效。';
		} else if (srcEnd < destOffset) {
			const begin = srcBegin, mid = srcEnd, end = destOffset;
			const newText = this.rotate(text, begin, mid, end);

			this.history.push(newText);
			this.located = new Set([...this.located].filter(i => i < begin || i >= end));
			this.finalChecked = false;
			return '移动成功，你的编辑规划中的部分字符位置已失效。';
		} else throw new Error();
	}

	public find(fragment: string): string {
		const text = this.getText();
		const first = text.indexOf(fragment);
		const last = text.lastIndexOf(fragment);
		if (first === -1)
			return '定位失败，未找到匹配项。';
		else if (first === last) {
			this.located.add(first);
			this.located.add(first + fragment.length);
			return String([first, first + fragment.length]);
		} else
			return '定位失败，找到超过一个匹配项。';
	}

	public slice(begin: number, end: number): string {
		const text = this.getText();
		if (this.located.has(begin)) {} else return Editor.notLocated(begin);
		if (this.located.has(end)) {} else return Editor.notLocated(end);

		const newText = text.slice(begin, end);
		this.history.push(newText);
		this.located = new Set([0]);
		this.finalChecked = false;
		return '截取成功，你的编辑规划中的字符位置已全部失效。';
	}

	public undo(limit: number): string {
		let i = 0;
		for (; i < limit && this.history.length > 1; i++) this.history.pop();
		this.located = new Set([0]);
		this.finalChecked = false;
		return `成功撤销了 ${i} 次操作，你的编辑规划中的字符位置已全部失效。`;
	}

	public reset(): string {
		this.history = [this.history[0]!];
		this.located = new Set([0]);
		this.finalChecked = false;
		return `重置成功，你的编辑规划中的字符位置已全部失效。`;
	}
}
