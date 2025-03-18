// components/Modal.tsx
import React from 'react';

interface ModalProps {
  showModal: boolean;
  closeModal: () => void;
  content: JSX.Element | null; // Content is a React component or null
}

const Modal: React.FC<ModalProps> = ({ showModal, closeModal, content }) => {
  if (!showModal) return null; // If not showing, return nothing

  return (
    <>
      {/* Background overlay with blur effect */}
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-0 z-40"></div>

      {/* Modal content */}
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 ">
        <div className="bg-white p-6 rounded shadow-lg w-[600px]">
          <button onClick={closeModal} className="text-gray-700 font-bold text-xl absolute top-2 right-2">X</button>
          <div>{content}</div>
        </div>
      </div>
    </>
  );
};

export default Modal;
