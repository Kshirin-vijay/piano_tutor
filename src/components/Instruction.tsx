import "./Instruction.css";

interface InstructionProps {
  text: string;
}

export default function Instruction({ text }: InstructionProps) {
  return <p className="instruction">{text}</p>;
}
