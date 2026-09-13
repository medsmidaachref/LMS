import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';

export const cppGenerator = new Blockly.CodeGenerator('CPP');
(cppGenerator as any).PRECEDENCE = 0;

cppGenerator.forBlock['math_number'] = function(block: any) { 
  return [String(block.getFieldValue('NUM')), (cppGenerator as any).PRECEDENCE]; 
};
cppGenerator.forBlock['text'] = function(block: any) { 
  return ['"' + block.getFieldValue('TEXT') + '"', (cppGenerator as any).PRECEDENCE]; 
};
cppGenerator.forBlock['text_print'] = function(block: any, generator: any) {
  const msg = generator.valueToCode(block, 'TEXT', (cppGenerator as any).PRECEDENCE) || '""';
  return `Serial.println(${msg});\n`;
};
cppGenerator.forBlock['controls_repeat_ext'] = function(block: any, generator: any) {
   const times = generator.valueToCode(block, 'TIMES', (cppGenerator as any).PRECEDENCE) || '0';
   const branch = generator.statementToCode(block, 'DO');
   return `for (int i = 0; i < ${times}; i++) {\n${branch}}\n`;
};
cppGenerator.forBlock['controls_if'] = function(block: any, generator: any) {
   let n = 0;
   let code = '', branchCode, conditionCode;
   do {
     conditionCode = generator.valueToCode(block, 'IF' + n, (cppGenerator as any).PRECEDENCE) || 'false';
     branchCode = generator.statementToCode(block, 'DO' + n);
     code += (n > 0 ? ' else ' : '') + `if (${conditionCode}) {\n${branchCode}}`;
     ++n;
   } while (block.getInput('IF' + n));
   if (block.getInput('ELSE')) {
     branchCode = generator.statementToCode(block, 'ELSE');
     code += ` else {\n${branchCode}}`;
   }
   return code + '\n';
};
cppGenerator.forBlock['logic_compare'] = function(block: any, generator: any) {
   const opMap: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
   const op = opMap[block.getFieldValue('OP')] || '==';
   const a = generator.valueToCode(block, 'A', (cppGenerator as any).PRECEDENCE) || '0';
   const b = generator.valueToCode(block, 'B', (cppGenerator as any).PRECEDENCE) || '0';
   return [`${a} ${op} ${b}`, (cppGenerator as any).PRECEDENCE];
};

// Custom Arduino Blocks
Blockly.Blocks['arduino_pin_mode'] = {
  init: function() {
    this.appendDummyInput().appendField("Définir la broche").appendField(new Blockly.FieldNumber(13), "PIN").appendField("en").appendField(new Blockly.FieldDropdown([["SORTIE", "OUTPUT"], ["ENTRÉE", "INPUT"]]), "MODE");
    this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(230);
  }
};
cppGenerator.forBlock['arduino_pin_mode'] = function(block: any) {
  return `pinMode(${block.getFieldValue('PIN')}, ${block.getFieldValue('MODE')});\n`;
};

Blockly.Blocks['arduino_digital_write'] = {
  init: function() {
    this.appendDummyInput().appendField("Mettre la broche").appendField(new Blockly.FieldNumber(13), "PIN").appendField("sur").appendField(new Blockly.FieldDropdown([["HAUT", "HIGH"], ["BAS", "LOW"]]), "STATE");
    this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(230);
  }
};
cppGenerator.forBlock['arduino_digital_write'] = function(block: any) {
  return `digitalWrite(${block.getFieldValue('PIN')}, ${block.getFieldValue('STATE')});\n`;
};

// Micro:bit Blocks
Blockly.Blocks['microbit_show_icon'] = {
  init: function() {
    this.appendDummyInput().appendField("Afficher l'icône").appendField(new Blockly.FieldDropdown([["CŒUR", "HEART"], ["SMILEY", "HAPPY"]]), "ICON");
    this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(160);
  }
};
pythonGenerator.forBlock['microbit_show_icon'] = function(block: any) {
  return `display.show(Image.${block.getFieldValue('ICON')})\n`;
};

// Thymio Blocks
Blockly.Blocks['thymio_move'] = {
  init: function() {
    this.appendDummyInput().appendField("Avancer à la vitesse").appendField(new Blockly.FieldNumber(100), "SPEED");
    this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(120);
  }
};
pythonGenerator.forBlock['thymio_move'] = function(block: any) {
  return `motor_left.target = ${block.getFieldValue('SPEED')}\nmotor_right.target = ${block.getFieldValue('SPEED')}\n`;
};

// IA Blocks
Blockly.Blocks['ia_predict'] = {
  init: function() {
    this.appendDummyInput().appendField("Prédire avec le modèle IA");
    this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour(290);
  }
};
pythonGenerator.forBlock['ia_predict'] = function(block: any) {
  return `model.predict()\n`;
};

export const moduleConfigs: Record<string, {
  aceMode: string;
  starterCode: string;
  toolbox: string;
  generateCode: (workspace: Blockly.WorkspaceSvg) => string;
}> = {
  python: {
    aceMode: 'python',
    starterCode: 'print("Bonjour le monde")\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block><block type="logic_compare"></block><block type="logic_operation"></block><block type="logic_boolean"></block></category>
        <category name="Boucles" colour="%{BKY_LOOPS_HUE}"><block type="controls_repeat_ext"></block><block type="controls_whileUntil"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block><block type="math_arithmetic"></block></category>
        <category name="Texte" colour="%{BKY_TEXTS_HUE}"><block type="text"></block><block type="text_print"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => pythonGenerator.workspaceToCode(ws)
  },
  arduino: {
    aceMode: 'c_cpp',
    starterCode: 'void setup() {\n  // Code de configuration :\n}\n\nvoid loop() {\n  // Code principal :\n}\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block><block type="logic_compare"></block></category>
        <category name="Boucles" colour="%{BKY_LOOPS_HUE}"><block type="controls_repeat_ext"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block></category>
        <category name="Texte" colour="%{BKY_TEXTS_HUE}"><block type="text"></block><block type="text_print"></block></category>
        <category name="Broches" colour="230"><block type="arduino_pin_mode"></block><block type="arduino_digital_write"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => cppGenerator.workspaceToCode(ws)
  },
  esp32: {
    aceMode: 'c_cpp',
    starterCode: 'void setup() {\n  // Code ESP32 :\n}\n\nvoid loop() {\n}\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block><block type="logic_compare"></block></category>
        <category name="Boucles" colour="%{BKY_LOOPS_HUE}"><block type="controls_repeat_ext"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block></category>
        <category name="Texte" colour="%{BKY_TEXTS_HUE}"><block type="text"></block><block type="text_print"></block></category>
        <category name="Broches" colour="230"><block type="arduino_pin_mode"></block><block type="arduino_digital_write"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => cppGenerator.workspaceToCode(ws)
  },
  'micro-bit': {
    aceMode: 'python',
    starterCode: 'from microbit import *\n\nwhile True:\n    display.scroll("Bonjour")\n    sleep(2000)\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block><block type="logic_compare"></block></category>
        <category name="Boucles" colour="%{BKY_LOOPS_HUE}"><block type="controls_repeat_ext"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block></category>
        <category name="Micro:bit" colour="160"><block type="microbit_show_icon"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => pythonGenerator.workspaceToCode(ws)
  },
  thymio: {
    aceMode: 'python',
    starterCode: '# Configuration Thymio\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block></category>
        <category name="Boucles" colour="%{BKY_LOOPS_HUE}"><block type="controls_repeat_ext"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block></category>
        <category name="Thymio" colour="120"><block type="thymio_move"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => pythonGenerator.workspaceToCode(ws)
  },
  ia: {
    aceMode: 'python',
    starterCode: '# Modèle IA\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Logique" colour="%{BKY_LOGIC_HUE}"><block type="controls_if"></block><block type="logic_compare"></block></category>
        <category name="Maths" colour="%{BKY_MATH_HUE}"><block type="math_number"></block></category>
        <category name="Texte" colour="%{BKY_TEXTS_HUE}"><block type="text"></block><block type="text_print"></block></category>
        <category name="IA" colour="290"><block type="ia_predict"></block></category>
        <category name="Variables" colour="%{BKY_VARIABLES_HUE}" custom="VARIABLE"></category>
      </xml>
    `,
    generateCode: (ws) => pythonGenerator.workspaceToCode(ws)
  },
  'html-css': {
    aceMode: 'html',
    starterCode: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Bonjour</title>\n</head>\n<body>\n  <h1>Bonjour le monde</h1>\n</body>\n</html>\n',
    toolbox: `
      <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
        <category name="Texte" colour="%{BKY_TEXTS_HUE}"><block type="text"></block></category>
      </xml>
    `,
    generateCode: () => '<!-- Génération depuis les blocs non supportée pour HTML -->'
  }
};

export const getModuleConfig = (slug: string) => {
   return moduleConfigs[slug] || moduleConfigs['python'];
};
