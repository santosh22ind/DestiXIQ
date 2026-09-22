export function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  return match[1]
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim();
}

export function extractBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(xml))) {
    blocks.push(match[1]);
  }
  return blocks;
}
