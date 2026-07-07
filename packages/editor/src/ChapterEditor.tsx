import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

export interface ChapterEditorProps {
  content: string;
  onChange?(html: string, text: string): void;
}

export function ChapterEditor({ content, onChange }: ChapterEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class: "chapter-editor__content",
        spellcheck: "true",
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange?.(currentEditor.getHTML(), currentEditor.getText());
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}
