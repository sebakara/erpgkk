'use client';
import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Italic, Code, List, ListOrdered, Heading1, Heading2, Heading3,
  Quote, Undo2, Redo2, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export function RichTextEditor({ content, onChange, editable = true }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '<p></p>',
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4 cursor-text',
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(editable);
    if (editable) editor.commands.focus('end');
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = content || '<p></p>';
    if (editor.isFocused && !editor.isEmpty) return;
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className={editable ? 'border border-gray-200 rounded-xl overflow-hidden bg-white' : 'bg-white rounded-xl'}>
      {editable && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
          <ToolbarGroup>
            <ToolBtn
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
            >
              <Heading1 size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <Heading2 size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
            >
              <Heading3 size={15} />
            </ToolBtn>
          </ToolbarGroup>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarGroup>
            <ToolBtn
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            >
              <Bold size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            >
              <Italic size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
              title="Inline code"
            >
              <Code size={15} />
            </ToolBtn>
          </ToolbarGroup>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarGroup>
            <ToolBtn
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet list"
            >
              <List size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered list"
            >
              <ListOrdered size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Blockquote"
            >
              <Quote size={15} />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              title="Code block"
            >
              <span className="font-mono text-xs font-bold">{'{}'}</span>
            </ToolBtn>
          </ToolbarGroup>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarGroup>
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >
              <Minus size={15} />
            </ToolBtn>
          </ToolbarGroup>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarGroup>
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo"
            >
              <Undo2 size={15} />
            </ToolBtn>
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo"
            >
              <Redo2 size={15} />
            </ToolBtn>
          </ToolbarGroup>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active
          ? 'bg-primary-100 text-primary-700'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  );
}
