declare module "marked-terminal" {
  interface TerminalRendererOptions {
    code?: (code: string) => string;
    blockquote?: (quote: string) => string;
    html?: (html: string) => string;
    heading?: (text: string, level: number) => string;
    hr?: () => string;
    list?: (body: string, ordered: boolean) => string;
    listitem?: (text: string) => string;
    paragraph?: (text: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    br?: () => string;
    del?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    image?: (href: string, title: string, text: string) => string;
    table?: (header: string, body: string) => string;
    tablerow?: (content: string) => string;
    tablecell?: (content: string, flags: object) => string;
    [key: string]: unknown;
  }

  /**
   * Extension object for `marked.use()` (marked v9+)
   * @param options - Optional terminal renderer options
   * @param highlightOptions - Optional syntax highlighting options
   * @returns Extension object for use with `marked.use()`
   */
  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: Record<string, unknown>,
  ): {
    renderer: Record<string, (...args: unknown[]) => string>;
    useNewRenderer: boolean;
  };

  const Renderer: new (options?: TerminalRendererOptions) => Record<string, unknown>;
  export default Renderer;
}
