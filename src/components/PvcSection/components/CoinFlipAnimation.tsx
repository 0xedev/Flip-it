import useSound from "use-sound";
import flipSfx from "/sounds/coin-flip.mp3";
import { useEffect } from "react";

const CoinFlipAnimation = ({ flipping }: { flipping: boolean }) => {
  const [playFlip] = useSound(flipSfx);

  useEffect(() => {
    if (flipping) playFlip(); // Play sound when flipping starts
  }, [flipping]);

  return <div className="coin-animation">{/* Your coin animation code */}</div>;
};

export default CoinFlipAnimation;
