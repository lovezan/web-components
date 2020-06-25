/* eslint-disable react/display-name */
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* React */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ReactEditor } from 'slate-react';
import { Editor, Node, Point, Transforms } from 'slate';
import _ from 'lodash';

/* Components */
import { MarkdownEditor } from '@accordproject/ui-markdown-editor';
import ClauseComponent from '../components/Clause';
import Conditional from '../components/Conditional';
import Optional from '../components/Optional';
import Formula from '../components/Formula';

/* Plugins */
import withClauseSchema, {
  CLAUSE,
  CONDITIONAL,
  FORMULA,
  VARIABLE
} from './plugins/withClauseSchema';
import withClauses, { isEditableClause } from './plugins/withClauses';
import withVariables, { isEditableVariable } from './plugins/withVariables';

/**
 * Adds the current value to local storage
 */
const storeLocal = (value) => {
  localStorage.setItem('contract-editor', value.toJSON());
};

/**
 * Default contract props
 */
const contractProps = {
  value: {
    object: 'value',
    document: {
      object: 'document',
      data: {},
      nodes: [{
        object: 'block',
        type: 'paragraph',
        data: {},
        nodes: [{
          object: 'text',
          text: 'Welcome! Edit this text to get started.',
          marks: []
        }],
      }]
    }
  },
  onChange: storeLocal,
  plugins: []
};

/**
 * ContractEditor React component, which wraps a markdown-editor
 * and assigns the ClausePlugin.
 *
 * @param {*} props the properties for the component
 */
const ContractEditor = (props) => {
  // const [search, setSearch] = useState();
  const [hoveringFormulaContract, setHoveringFormulaContract] = useState(false);
  const [formulaDependents, setFormulaDependents] = useState({});
  const withClausesProps = {
    onClauseUpdated: props.onClauseUpdated,
    pasteToContract: props.pasteToContract
  };
  const customDecorate = useCallback(([node, path]) => {
    // const ranges = [];

    // console.log('customDecorate node', node);
    // console.log('customDecorate path', path);
    // if (hoveringFormulaContract) {
    if (node.type === 'variable' && formulaDependents[node.data.name]) {
      // console.log('---------------------------');
      // console.log('node', node);
      // console.log('path', path);
      // console.log('---------------------------');
      const offset = 0;
      // return [{
      //   anchor: { path, offset: 0 - node.children[0].text.length },
      //   focus: { path, offset: 0 },
      //   highlight: true,
      // }];

      const [NODE_ONE, PATH_ONE] = Node.descendants(node);
      // console.log('[...path, 0]', [...path, 0]);
      //   NODE_ONE : 0: [
      //     {object: "text", text: "2.5"}
      //   1: [0]
      // ]

      // console.log('TRIAL', Node.fragment(node, {
      //   anchor: { path: [0], offset: 0 },
      //   focus: { path: [0], offset: node.children[0].text.length }
      // }));


      return [{
        anchor: { path: [...path, 0], offset: 0 },
        focus: { path: [...path, 0], offset: node.children[0].text.length },
        bold: true,
      }];
      // }
    }


    return [];
  }, [formulaDependents]);

  const customElements = (attributes, children, element, editor) => {
    const CLAUSE_PROPS = {
      templateUri: element.data.src,
      name: element.data.name,
      clauseProps: props.clauseProps,
      readOnly: props.readOnly,
      attributes,
      editor,
    };
    const VARIABLE_PROPS = {
      name: element.data.name,
      className: VARIABLE,
      ...attributes
    };
    const CONDITIONAL_PROPS = {
      readOnly: props.readOnly,
      attributes
    };
    const FORMULA_PROPS = {
      name: element.data.name,
      className: FORMULA,
      setHoveringFormulaContract,
      setFormulaDependents,
      attributes,
      editor,
    };
    const OPTIONAL_PROPS = {
      readOnly: props.readOnly,
      attributes,
    };
    const returnObject = {
      [CLAUSE]: () => (<ClauseComponent {...CLAUSE_PROPS}>{children}</ClauseComponent>),
      [VARIABLE]: () => {
        console.log('--------------------');
        // console.log('render editor', editor);
        // console.log('render element', element);
        // console.log('||||||||||||||||||||');
        return (<span {...VARIABLE_PROPS}>{children}</span>);
      },
      [CONDITIONAL]: () => (<Conditional {...CONDITIONAL_PROPS}>{children}</Conditional>),
      [FORMULA]: () => (<Formula {...FORMULA_PROPS}>{children}</Formula>),
      [OPTIONAL]: () => (<Optional {...OPTIONAL_PROPS}>{children}</Optional>),
    };
    return returnObject;
  };


  const augmentEditor = editor => (
    props.augmentEditor
      ? props.augmentEditor(withVariables(withClauses(withClauseSchema(editor), withClausesProps)))
      : withVariables(withClauses(withClauseSchema(editor), withClausesProps))
  );

  const isEditable = (...args) => isEditableClause(...args)
  && isEditableVariable(props.lockText, ...args);

  const canCopy = editor => (!((
    editor.isInsideClause(editor.selection.anchor)
    || editor.isInsideClause(editor.selection.focus)
  )));

  const canKeyDown = (editor, event) => {
    if (
      (event.keyCode || event.charCode) === 8
      && Point.equals(Editor.start(editor, editor.selection.anchor.path), editor.selection.anchor)
    ) {
      const [match] = Editor
        .nodes(editor, { at: Editor.previous(editor)[1], match: n => n.type === CLAUSE });
      return !match;
    }
    return true;
  };

  const onDragStart = (editor, event) => {
    event.stopPropagation();
    const node = ReactEditor.toSlateNode(editor, event.target);
    const path = ReactEditor.findPath(editor, node);
    const range = Editor.range(editor, path);
    event.dataTransfer.setData('text', JSON.stringify(range));
  };

  const onDragOver = (editor, event) => {
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  };

  // return true if should continue through to next handler, else return false
  const onDrop = (editor, event) => {
    event.preventDefault();
    const targetRange = ReactEditor.findEventRange(editor, event);
    const [targetIsClause] = Editor.nodes(editor, { match: n => n.type === 'clause', at: targetRange });
    if (targetIsClause) return false; // do not allow dropping inside of a clause
    const sourceRange = JSON.parse(event.dataTransfer.getData('text'));
    const [clauseNode] = Editor.nodes(editor, { match: n => n.type === 'clause', at: sourceRange });
    if (!clauseNode) return true; // continue to next handler if not a clause
    const node = ReactEditor.toSlateNode(editor, event.target);
    const path = ReactEditor.findPath(editor, node);

    const nodes = [...Node.ancestors(editor, path, { reverse: false })];
    // first node is root editor so second will be top level after root editor
    const topLevelNodeAndPath = nodes[1];
    // if no top level after editor then the node was already a top level node so use its own path
    const topLevelPath = topLevelNodeAndPath ? topLevelNodeAndPath[1] : path;
    if (topLevelPath.length) {
      Transforms.select(editor, topLevelPath);
    } else {
      // if top level is empty array then we are at the editor level & should use the target range
      Transforms.select(editor, targetRange);
    }

    let edge = 'end';
    // if at the top level node, use the offset to determine which half we are in
    if (topLevelPath === path || (path[1] === 0 && path[0] === topLevelPath[0])) {
      const midpoint = Node.get(editor, targetRange.focus.path).text.length / 2;
      if (targetRange.focus.offset < midpoint) {
        edge = 'start';
      }
    } else { // if not at the top level node
      // divy up the children & see where the target child is in relation to middle child
      const midChild = [...Node.children(editor, topLevelPath)].length / 2;
      if (path[1] < midChild) {
        edge = 'start';
      }
    }
    Transforms.collapse(editor, { edge });
    Transforms.removeNodes(editor, { at: sourceRange.anchor.path, match: n => n.type === 'clause' });
    Transforms.insertNodes(editor, clauseNode[0]);
    return false;
  };

  // console.log('value: ', JSON.stringify(props.value));

  return (
    <MarkdownEditor
      augmentEditor={augmentEditor}
      isEditable={isEditable}
      value={props.value || contractProps.value}
      onChange={props.onChange || contractProps.onChange}
      customDecorate={customDecorate}
      customElements={customElements}
      lockText={props.lockText}
      readOnly={props.readOnly}
      canBeFormatted={editor => !props.lockText || !editor.isInsideClause()}
      canCopy={canCopy}
      canKeyDown={canKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      activeButton={props.activeButton}
      data-testid='editor'
  />
  );
};


/**
 * The property types for this component
 */
ContractEditor.propTypes = {
  activeButton: PropTypes.object,
  augmentEditor: PropTypes.func,
  value: PropTypes.array,
  onChange: PropTypes.func,
  lockText: PropTypes.bool,
  readOnly: PropTypes.bool,
  pasteToContract: PropTypes.func,
  clauseMap: PropTypes.object,
  clauseProps: PropTypes.shape({
    CLAUSE_DELETE_FUNCTION: PropTypes.func,
    CLAUSE_EDIT_FUNCTION: PropTypes.func,
    CLAUSE_TEST_FUNCTION: PropTypes.func,
  }),
  onClauseUpdated: PropTypes.func,
  onUndoOrRedo: PropTypes.func,
  plugins: PropTypes.arrayOf(PropTypes.shape({
    onEnter: PropTypes.func,
    onKeyDown: PropTypes.func,
    name: PropTypes.string.isRequired,
    augmentSchema: PropTypes.func,
  })),
};

export default ContractEditor;
