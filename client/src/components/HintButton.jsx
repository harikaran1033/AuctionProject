import { useState } from "react";

export default function HintButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Hint Button */}
      <button
        className="btn btn-primary rounded-full w-5 h-5    shadow-lg"
        onClick={() => setOpen(true)}
      >
        💡
      </button>

      {/* Modal */}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Having an issue?</h3>
            <p className="py-3">
              If you face any issue while using the auction site, simply{" "}
              <span className="font-semibold">refresh the page</span>.  
              This fixes most problems instantly!
            </p>

            <div className="modal-action">
              <button className="btn" onClick={() => setOpen(false)}>
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
