import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext.jsx';

export default function PollMessage({ poll, onVote }) {
  const { user } = useContext(AuthContext);

  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

  const handleOptionClick = (optionText) => {
    if (onVote) {
      onVote(optionText);
    }
  };

  return (
    <div className="flex flex-col gap-3 bg-dark-incoming/40 border border-white/5 rounded-xl p-4 max-w-[280px] w-full shadow-lg">
      <div>
        <h4 className="text-sm font-bold text-white tracking-wide leading-tight">{poll.question}</h4>
        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Select one option to vote</p>
      </div>

      <div className="space-y-2.5">
        {poll.options.map((option, idx) => {
          const votesCount = option.votes?.length || 0;
          const pct = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;
          const hasVoted = option.votes?.some(id => id === user?._id);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleOptionClick(option.text)}
              className="w-full text-left relative overflow-hidden rounded-lg border border-white/10 p-2.5 bg-white/5 hover:bg-white/10 transition outline-none group flex flex-col gap-1"
            >
              {/* Animated Progress bar */}
              <div
                style={{ width: `${pct}%` }}
                className={`absolute left-0 top-0 bottom-0 transition-all duration-300 opacity-20 ${
                  hasVoted ? 'bg-whatsapp-light' : 'bg-slate-500'
                }`}
              />

              <div className="flex justify-between items-center z-10 text-xs font-semibold">
                <span className={`truncate ${hasVoted ? 'text-whatsapp-light' : 'text-white'}`}>
                  {option.text}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">{votesCount}</span>
              </div>

              {/* Vote details bar */}
              <div className="flex justify-between items-center text-[9px] text-slate-500 z-10 font-medium">
                <span>{pct.toFixed(0)}%</span>
                {hasVoted && <span className="text-whatsapp-light font-bold">✓ Voted</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[9px] text-slate-400 font-bold border-t border-white/5 pt-2 text-right">
        Total votes: {totalVotes}
      </div>
    </div>
  );
}
