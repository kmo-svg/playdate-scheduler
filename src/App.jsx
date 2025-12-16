import React, { useState, useEffect } from 'react';
import { Calendar, Users } from 'lucide-react';

const App = () => {
  const [parentName, setParentName] = useState('');
  const [parents, setParents] = useState([]);
  const [currentParent, setCurrentParent] = useState(null);
  const [showNameInput, setShowNameInput] = useState(true);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === 20 && min > 0) break;
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const display = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        slots.push({ time, display });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const addParent = () => {
    if (parentName.trim()) {
      const newParent = {
        id: Date.now(),
        name: parentName.trim(),
        availability: {}
      };
      setParents([...parents, newParent]);
      setCurrentParent(newParent);
      setParentName('');
      setShowNameInput(false);
    }
  };

  const toggleSlot = (day, time) => {
    if (!currentParent) return;
    
    setParents(parents.map(p => {
      if (p.id === currentParent.id) {
        const key = `${day}-${time}`;
        const newAvailability = { ...p.availability };
        if (newAvailability[key]) {
          delete newAvailability[key];
        } else {
          newAvailability[key] = true;
        }
        return { ...p, availability: newAvailability };
      }
      return p;
    }));
  };

  const getSlotCount = (day, time) => {
    const key = `${day}-${time}`;
    return parents.filter(p => p.availability[key]).length;
  };

  const getSlotColor = (day, time) => {
    const count = getSlotCount(day, time);
    if (count === 0) return 'bg-gray-100';
    if (count === parents.length) return 'bg-green-500';
    if (count >= parents.length * 0.7) return 'bg-green-400';
    if (count >= parents.length * 0.5) return 'bg-yellow-400';
    return 'bg-orange-400';
  };

  const isCurrentParentAvailable = (day, time) => {
    if (!currentParent) return false;
    const key = `${day}-${time}`;
    return currentParent.availability[key];
  };

  const switchParent = (parent) => {
    setCurrentParent(parent);
  };

  const getBestTimes = () => {
    const slotCounts = [];
    days.forEach(day => {
      timeSlots.forEach(slot => {
        const count = getSlotCount(day, slot.time);
        if (count > 0) {
          slotCounts.push({ day, time: slot.display, count });
        }
      });
    });
    return slotCounts.sort((a, b) => b.count - a.count).slice(0, 5);
  };

  useEffect(() => {
    if (parents.length > 0 && currentParent) {
      const updated = parents.find(p => p.id === currentParent.id);
      if (updated) setCurrentParent(updated);
    }
  }, [parents]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">Play Date Scheduler</h1>
          </div>

          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Parents</h2>
            </div>
            
            {showNameInput ? (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addParent()}
                  placeholder="Enter your name"
                  className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={addParent}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNameInput(true)}
                className="mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
              >
                + Add Another Parent
              </button>
            )}

            <div className="flex flex-wrap gap-2">
              {parents.map(parent => (
                <button
                  key={parent.id}
                  onClick={() => switchParent(parent)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentParent?.id === parent.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-600 border border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {parent.name}
                </button>
              ))}
            </div>

            {currentParent && (
              <p className="mt-3 text-sm text-gray-600">
                Currently editing: <span className="font-semibold">{currentParent.name}</span>
              </p>
            )}
          </div>

          {parents.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Top Available Times</h3>
              <div className="space-y-1">
                {getBestTimes().map((slot, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    <span className="font-medium">{slot.day} {slot.time}</span> - {slot.count}/{parents.length} available
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentParent && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Click on time slots below to mark when <strong>{currentParent.name}</strong> is available. 
                Colors show how many parents are available: <span className="text-green-600 font-semibold">Green = Most</span>, 
                <span className="text-yellow-600 font-semibold"> Yellow = Some</span>, 
                <span className="text-orange-600 font-semibold"> Orange = Few</span>
              </p>
            </div>
          )}

          {currentParent ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white p-2 text-left font-semibold text-gray-700 border-b-2 border-purple-300">
                      Time
                    </th>
                    {days.map(day => (
                      <th key={day} className="p-2 text-center font-semibold text-gray-700 border-b-2 border-purple-300 min-w-[100px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(slot => (
                    <tr key={slot.time} className="hover:bg-gray-50">
                      <td className="sticky left-0 bg-white p-2 text-sm font-medium text-gray-600 border-b border-gray-200">
                        {slot.display}
                      </td>
                      {days.map(day => {
                        const available = isCurrentParentAvailable(day, slot.time);
                        const colorClass = getSlotColor(day, slot.time);
                        const count = getSlotCount(day, slot.time);
                        
                        return (
                          <td key={day} className="p-1 border-b border-gray-200">
                            <button
                              onClick={() => toggleSlot(day, slot.time)}
                              className={`w-full h-10 rounded transition-all ${
                                available
                                  ? 'ring-2 ring-purple-600 ring-offset-1'
                                  : ''
                              } ${colorClass} hover:opacity-80 relative`}
                            >
                              {count > 0 && (
                                <span className="text-xs font-semibold text-gray-800">
                                  {count}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>Add a parent to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;