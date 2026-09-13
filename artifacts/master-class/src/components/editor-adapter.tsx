import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as Blockly from 'blockly';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/theme-tomorrow_night';

import { getModuleConfig } from '@/lib/modules-config';

export type EditorMode = 'block' | 'code';

export interface EditorAdapterProps {
  moduleSlug: string;
  editorMode: EditorMode;
  initialBlockXml: string;
  initialSourceCode: string;
  onChange: (data: { blockXml: string; sourceCode: string }) => void;
  className?: string;
}

export interface EditorAdapterRef {
  loadBlocks: (xml: string) => void;
  getXml: () => string;
  getGeneratedCode: () => string;
  setTextCode: (code: string) => void;
  getTextCode: () => string;
}

export const EditorAdapter = forwardRef<EditorAdapterRef, EditorAdapterProps>(({
  moduleSlug,
  editorMode,
  initialBlockXml,
  initialSourceCode,
  onChange,
  className = ''
}, ref) => {
  const blocklyRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [codeValue, setCodeValue] = useState(initialSourceCode);
  const codeValueRef = useRef(initialSourceCode);
  const initializedBlockXml = useRef(false);

  const config = getModuleConfig(moduleSlug);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize Blockly
  useEffect(() => {
    if (!blocklyRef.current) return;
    
    // Clean up previous workspace
    if (workspaceRef.current) {
      workspaceRef.current.dispose();
      workspaceRef.current = null;
    }

    workspaceRef.current = Blockly.inject(blocklyRef.current, {
      toolbox: config.toolbox,
      scrollbars: true,
      trashcan: true,
      theme: Blockly.Themes.Classic
    });

    if (initialBlockXml && !initializedBlockXml.current) {
      try {
        const dom = Blockly.utils.xml.textToDom(initialBlockXml);
        Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
        initializedBlockXml.current = true;
      } catch (e) {
        // Suppress console logging for invalid stored XML
      }
    }

    const handleChange = () => {
      if (!workspaceRef.current) return;
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      const xmlText = Blockly.Xml.domToText(xml);
      
      onChangeRef.current({
        blockXml: xmlText,
        sourceCode: codeValueRef.current
      });
    };

    workspaceRef.current.addChangeListener(handleChange);

    const handleResize = () => {
      if (workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (workspaceRef.current) {
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
    };
  }, [moduleSlug, config.toolbox]);

  // Handle ace changes
  const handleCodeChange = (newValue: string) => {
    setCodeValue(newValue);
    codeValueRef.current = newValue;
    if (workspaceRef.current) {
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      const xmlText = Blockly.Xml.domToText(xml);
      onChangeRef.current({
        blockXml: xmlText,
        sourceCode: newValue
      });
    }
  };

  useImperativeHandle(ref, () => ({
    loadBlocks: (xml: string) => {
      if (workspaceRef.current && xml) {
        try {
          workspaceRef.current.clear();
          const dom = Blockly.utils.xml.textToDom(xml);
          Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
        } catch(e) {
          // Suppress parsing errors
        }
      }
    },
    getXml: () => {
      if (workspaceRef.current) {
        const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
        return Blockly.Xml.domToText(xml);
      }
      return initialBlockXml;
    },
    getGeneratedCode: () => {
      if (workspaceRef.current) {
        return config.generateCode(workspaceRef.current);
      }
      return '';
    },
    setTextCode: (code: string) => {
       setCodeValue(code);
       codeValueRef.current = code;
       // Trigger onChange
       if (workspaceRef.current) {
         const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
         const xmlText = Blockly.Xml.domToText(xml);
         onChangeRef.current({ blockXml: xmlText, sourceCode: code });
       }
    },
    getTextCode: () => codeValueRef.current
  }));

  // Force resize on mode switch so Blockly renders properly
  useEffect(() => {
    if (editorMode === 'block' && workspaceRef.current) {
      setTimeout(() => {
        Blockly.svgResize(workspaceRef.current as Blockly.WorkspaceSvg);
      }, 10);
    }
  }, [editorMode]);

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl border border-border bg-background ${className}`}>
      <div 
        ref={blocklyRef} 
        className="absolute inset-0 z-10 bg-white"
        style={{ display: editorMode === 'block' ? 'block' : 'none' }}
      />
      <div 
        className="absolute inset-0 z-0 bg-background"
        style={{ display: editorMode === 'code' ? 'block' : 'none', zIndex: editorMode === 'code' ? 10 : 0 }}
      >
        <AceEditor
          mode={config.aceMode}
          theme="tomorrow_night"
          name="ace-editor"
          onChange={handleCodeChange}
          value={codeValue}
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={true}
          width="100%"
          height="100%"
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            useWorker: false // Disable syntax checker workers to avoid console noise
          }}
          className="h-full w-full"
        />
      </div>
    </div>
  );
});

EditorAdapter.displayName = 'EditorAdapter';
