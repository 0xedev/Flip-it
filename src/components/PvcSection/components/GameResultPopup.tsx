import useSound from "use-sound";
import winSfx from "/sounds/win.mp3";
import loseSfx from "/sounds/lose.mp3";
import { useEffect } from "react";

const GameResultPopup = ({ result }: { result: "win" | "lose" }) => {
  const [playWin] = useSound(winSfx);
  const [playLose] = useSound(loseSfx);

  useEffect(() => {
    if (result === "win") playWin();
    if (result === "lose") playLose();
  }, [result]);

  return <div className="popup">{/* Your popup UI */}</div>;
};

export default GameResultPopup;
