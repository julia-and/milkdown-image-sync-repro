import React, { useContext, useRef, useEffect, createContext, useState, useMemo, useCallback, useLayoutEffect } from "react";
const editorInfoContext = createContext(
  {}
);
function useGetEditor() {
  const {
    dom,
    editor: editorRef,
    setLoading,
    editorFactory: getEditor
  } = useContext(editorInfoContext);
  const domRef = useRef(null);
  useEffect(() => {
    const div = domRef.current;
    if (!getEditor) return;
    if (!div) return;
    dom.current = div;
    const editor = getEditor(div);
    if (!editor) return;
    setLoading(true);
    editor.create().then((editor2) => {
      editorRef.current = editor2;
    }).finally(() => {
      setLoading(false);
    }).catch(console.error);
    return () => {
      editor.destroy().catch(console.error);
    };
  }, [dom, editorRef, getEditor, setLoading]);
  return domRef;
}
const Milkdown = () => {
  const domRef = useGetEditor();
  return /* @__PURE__ */ React.createElement("div", { "data-milkdown-root": true, ref: domRef });
};
const MilkdownProvider = ({ children }) => {
  const dom = useRef(void 0);
  const [editorFactory, setEditorFactory] = useState(
    void 0
  );
  const editor = useRef(void 0);
  const [loading, setLoading] = useState(true);
  const editorInfoCtx = useMemo(
    () => ({
      loading,
      dom,
      editor,
      setLoading,
      editorFactory,
      setEditorFactory
    }),
    [loading, editorFactory]
  );
  return /* @__PURE__ */ React.createElement(editorInfoContext.Provider, { value: editorInfoCtx }, children);
};
function useEditor(getEditor, deps = []) {
  const editorInfo = useContext(editorInfoContext);
  const factory = useCallback(getEditor, deps);
  useLayoutEffect(() => {
    editorInfo.setEditorFactory(() => factory);
  }, [editorInfo, factory]);
  return {
    loading: editorInfo.loading,
    get: () => editorInfo.editor.current
  };
}
function useInstance() {
  const editorInfo = useContext(editorInfoContext);
  const getInstance = useCallback(() => {
    return editorInfo.editor.current;
  }, [editorInfo.editor]);
  return [editorInfo.loading, getInstance];
}
export {
  Milkdown,
  MilkdownProvider,
  useEditor,
  useInstance
};
//# sourceMappingURL=index.js.map
