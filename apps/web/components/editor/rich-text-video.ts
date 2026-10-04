import { Node, mergeAttributes } from "@tiptap/core";

export type RichTextVideoOptions = {
  HTMLAttributes: Record<string, unknown>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richTextVideo: {
      setVideo: (options: {
        src: string;
        poster?: string | null;
      }) => ReturnType;
    };
  }
}

/**
 * Block video node for service (and similar) rich-text descriptions.
 * Renders a native <video controls> element with CDN src.
 */
export const RichTextVideo = Node.create<RichTextVideoOptions>({
  name: "richTextVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "rich-text-video",
        controls: true,
        playsInline: true,
        preload: "metadata",
      },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => {
          if (!attributes.src) return {};
          return { src: attributes.src };
        },
      },
      poster: {
        default: null,
        parseHTML: (element) => element.getAttribute("poster"),
        renderHTML: (attributes) => {
          if (!attributes.poster) return {};
          return { poster: attributes.poster };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        controls: "controls",
        playsinline: "playsinline",
        preload: "metadata",
      }),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          if (!options?.src) return false;
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              poster: options.poster || null,
            },
          });
        },
    };
  },
});
