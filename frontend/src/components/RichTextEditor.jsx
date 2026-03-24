import React, { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";

const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Type a message...",
  mentionUsers = [],
  onMentionSearch = null,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Image.configure({
        allowBase64: true,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention bg-blue-500/20 text-blue-400 rounded px-1",
        },
        suggestion: {
          items: ({ query }) => {
            if (!query) return [];
            if (onMentionSearch) {
              onMentionSearch(query);
            }
            return mentionUsers
              .filter((user) =>
                user.username.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 5)
              .map((user) => ({
                id: user._id,
                label: user.username,
                name: user.first_name,
              }));
          },
          render: () => {
            let popup;
            return {
              onStart: (props) => {
                popup = createMentionPopup(props);
              },
              onUpdate: (props) => {
                if (popup) popup.update(props);
              },
              onKeyDown: (props) => {
                if (popup) return popup.onKeyDown(props);
                return false;
              },
              onExit: () => {
                if (popup) popup.destroy();
              },
            };
          },
        },
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const toggleCode = () => editor.chain().focus().toggleCode().run();
  const setHeading1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const setHeading2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-zinc-800/50 border-b border-zinc-700">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-zinc-700 pr-1">
          <ToolbarButton
            onClick={toggleBold}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
            icon={<Bold className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={toggleItalic}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
            icon={<Italic className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={toggleUnderline}
            active={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
            icon={<UnderlineIcon className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={toggleCode}
            active={editor.isActive("code")}
            title="Code"
            icon={<Code className="w-4 h-4" />}
          />
        </div>

        {/* Headings */}
        <div className="flex gap-1 border-r border-zinc-700 pr-1">
          <ToolbarButton
            onClick={setHeading1}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
            icon={<Heading1 className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={setHeading2}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
            icon={<Heading2 className="w-4 h-4" />}
          />
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-zinc-700 pr-1">
          <ToolbarButton
            onClick={toggleBulletList}
            active={editor.isActive("bulletList")}
            title="Bullet List"
            icon={<List className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={toggleOrderedList}
            active={editor.isActive("orderedList")}
            title="Ordered List"
            icon={<ListOrdered className="w-4 h-4" />}
          />
        </div>

        {/* Media & Links */}
        <div className="flex gap-1 border-r border-zinc-700 pr-1">
          <ToolbarButton
            onClick={addLink}
            title="Add Link"
            icon={<LinkIcon className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={addImage}
            title="Add Image"
            icon={<ImageIcon className="w-4 h-4" />}
          />
        </div>

        {/* History */}
        <div className="flex gap-1">
          <ToolbarButton
            onClick={undo}
            disabled={!editor.can().undo()}
            title="Undo"
            icon={<Undo2 className="w-4 h-4" />}
          />
          <ToolbarButton
            onClick={redo}
            disabled={!editor.can().redo()}
            title="Redo"
            icon={<Redo2 className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-invert prose-sm max-w-none p-3 focus:outline-none min-h-[100px]"
        style={{
          color: "rgb(212, 212, 212)",
        }}
      />
    </div>
  );
};

const ToolbarButton = ({ onClick, active, disabled, title, icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? "bg-indigo-600 text-white"
        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {icon}
  </button>
);

// Helper function to create mention popup
const createMentionPopup = (props) => {
  const popup = new MentionPopup(props);
  return popup;
};

class MentionPopup {
  constructor(props) {
    this.props = props;
    this.element = null;
    this.selectedIndex = 0;
  }

  update(props) {
    this.props = props;
  }

  onKeyDown(props) {
    const { event } = props;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        this.props.items.length - 1
      );
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.selectItem(this.selectedIndex);
      return true;
    }

    return false;
  }

  selectItem(index) {
    const item = this.props.items[index];
    if (item) {
      this.props.command({ id: item.id, label: item.label });
    }
  }

  destroy() {
    if (this.element) {
      this.element.remove();
    }
  }
}

export default RichTextEditor;
