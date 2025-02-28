import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Define the type for each FAQ item
interface FAQItem {
  question: string;
  answer: string;
}

const FAQ = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const navigate = useNavigate();

  // Explicitly type the faqs array
  const faqs: FAQItem[] = [
    {
      question: "What is FlipIt?",
      answer:
        "FlipIt is a decentralized coin-flipping game where you can play against the computer (PvC) or other players (PvP) using cryptocurrency tokens.",
    },
    {
      question: "How do I play?",
      answer:
        "Choose a game mode (PvC or PvP), select a token and bet amount, click on the coin symbol to toggle between head or tail and flip the coin! Results are determined on-chain.",
    },
    {
      question: "Which tokens are supported?",
      answer:
        "Currently, we support tokens like STABLEAI, DIG, WEB9, BNKR, FED, RaTcHeT, and GIRTH. Check the game interface for the full list.",
    },
    {
      question: "Is it fair?",
      answer: "Yes! game uses a verifiable random function (VRF) for fairness.",
    },
    {
      question: "How do I withdraw my winnings?",
      answer:
        "After winning, Rewards are automatically transfered to your wallet.",
    },
    {
      question: "How are rewards shared in FlipIt?",
      answer:
        "In every game, the total reward pool is split as follows: 90% goes directly to the winning player, and 10% is allocated to the house. The house portion is later burnt to reduce the token supply.",
    },
    {
      question: "What does '90% to the player' mean?",
      answer:
        "If you win a game, you receive 90% of the total bet amount as your reward. For example, if the bet is 100 tokens, the winner gets 90 tokens, and the house takes 10 tokens.",
    },
    {
      question: "What happens to the 10% house share?",
      answer:
        "The 10% allocated to the house is sent to a smart contract. Periodically, this amount is burnt—permanently removed from circulation—to benefit the token ecosystem by reducing supply.",
    },
    {
      question: "Why does the house burn its share?",
      answer:
        "Burning the house’s 10% share helps increase the scarcity of the tokens used in the game (like STABLEAI, DIG, etc.), potentially raising their value over time for all holders and players.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-black py-16 px-4">
      <button onClick={() => navigate("/")} className="back-button">
        Back to Home
      </button>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-purple-300 mb-8 text-center">
          Frequently Asked Questions
        </h1>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-gray-800/50 rounded-lg overflow-hidden"
            >
              <button
                className="w-full text-left p-4 flex justify-between items-center text-purple-200 hover:bg-gray-700/50 transition-colors"
                onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
              >
                <span className="font-semibold">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${
                    openFAQ === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFAQ === index && (
                <div className="p-4 text-gray-300 bg-gray-900/50">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;
