// A bounded arithmetic parser; input never becomes JavaScript.
export function calculate(input) {
  if(typeof input!=='string' || input.length>256)return null;
  const expression=input.trim().replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');
  if(!/[+*/^%()-]/.test(expression) || /^\d{4}-\d{2}-\d{2}$/.test(expression))return null;
  const tokens=expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/%^\-]|\S/gi) || [];
  let position=0;
  function atom() {
    const token=tokens[position++];
    if(token==='(') {const value=sum();if(tokens[position++]!==')')throw Error();return value;}
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token || ''))throw Error();
    return Number(token);
  }
  function power() {const value=atom();if(tokens[position]==='^'){position++;return value**unary();}return value;}
  function unary() {if(['+','-'].includes(tokens[position])){const sign=tokens[position++];return (sign==='-'?-1:1)*unary();}return power();}
  function product() {
    let value=unary();
    while(['*','/','%'].includes(tokens[position])){const op=tokens[position++],right=unary();value=op==='*'?value*right:op==='/'?value/right:value%right;}
    return value;
  }
  function sum() {let value=product();while(['+','-'].includes(tokens[position])){const op=tokens[position++],right=product();value=op==='+'?value+right:value-right;}return value;}
  try {
    const value=sum();
    if(position!==tokens.length || !Number.isFinite(value))return null;
    return {expression:input.trim(),result:String(Number(value.toPrecision(12)))};
  } catch {return null;}
}
