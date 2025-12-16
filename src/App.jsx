import React, { useState, useEffect } from 'react';
import { Calendar, Users } from 'lucide-react';

const App = () => {
  const [childName, setChildName] = useState('');
  const [children, setChildren] = useState([]);
  const [currentChild, setCurrentChild] = useState(null);
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

  const addChild = () => {
    if (childName.trim()) {
      const newChild = {
        id: Date.now(),
        name: childName.trim(),
        availability: {}
      };
      setChildren([...children, newChild]);
      setCurrentChild(newChild);
      setChildName('');
      setShowNameInput(false);
    }
  };

  const toggleSlot = (day, time) => {
    if (!currentChild) return;
    
    setChildren(children.map(c => {
      if (c.id === currentChild.id) {
        const key = `${day}-${time}`;
        const newAvailability = { ...c.availability };
        if (newAvailability[key]) {
          delete newAvailability[key];
        } else {
          newAvailability[key] = true;
        }
        return { ...c, availability: newAvailability };
      }
      return c;
    }));
  };

  const getAvailableChildren = (day, time) => {
    const key = `${day}-${time}`;
    return children.filter(c => c.availability[key]);
  };

  const getSlotColor = (day, time) => {
    const availableKids = getAvailableChildren(day, time);
    return availableKids.length > 0 ? 'bg-green-400' : 'bg-gray-100';
  };

  const isCurrentChildAvailable = (day, time) => {
    if (!currentChild) return false;
    const key = `${day}-${time}`;
    return currentChild.availability[key];
  };

  const switchChild = (child) => {
    setCurrentChild(child);
  };

  const getBestTimes = () => {
    const slotCounts = [];
    days.forEach(day => {
      timeSlots.forEach(slot => {
        const availableKids = getAvailableChildren(day, slot.time);
        if (availableKids.length > 0) {
          slotCounts.push({ 
            day, 
            time: slot.display, 
            count: availableKids.length,
            names: availableKids.map(k => k.name).join(', ')
          });
        }
      });
    });
    return slotCounts.sort((a, b) => b.count - a.count).slice(0, 5);
  };

  useEffect(() => {
    if (children.length > 0 && currentChild) {
      const updated = children.find(c => c.id === currentChild.id);
      if (updated) setCurrentChild(updated);
    }
  }, [children]);

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
              <h2 className="text-lg font-semibold text-gray-800">Children</h2>
            </div>
            
            {showNameInput ? (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChild()}
                  placeholder="Enter child's name"
                  className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={addChild}
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
                + Add Another Child
              </button>
            )}

            <div className="flex flex-wrap gap-2">
              {children.map(child => (
                <button
                  key={child.id}
                  onClick={() => switchChild(child)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentChild?.id === child.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-600 border border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>

            {currentChild && (
              <p className="mt-3 text-sm text-gray-600">
                Currently editing: <span className="font-semibold">{currentChild.name}</span>
              </p>
            )}
          </div>

          {children.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Top Available Times</h3>
              <div className="space-y-1">
                {getBestTimes().map((slot, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    <span className="font-medium">{slot.day} {slot.time}</span> - {slot.names}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentChild && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Click on time slots below to mark when <strong>{currentChild.name}</strong> is available. 
                Green slots show when at least one child is available. Hover over a slot to see names.
              </p>
            </div>
          )}

          {currentChild ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white p-2 text-left font-semibold text-gray-700 border-b-2 border-purple-300">
                      Time
                    </th>
                    {days.map(day => (
                      <th key={day} className="p-2 text-center font-semibold text-gray-700 border-b-2 border-purple-300 min-w-[120px]">
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
                        const available = isCurrentChildAvailable(day, slot.time);
                        const colorClass = getSlotColor(day, slot.time);
                        const availableKids = getAvailableChildren(day, slot.time);
                        const kidNames = availableKids.map(k => k.name).join(', ');
                        
                        return (
                          <td key={day} className="p-1 border-b border-gray-200">
                            <button
                              onClick={() => toggleSlot(day, slot.time)}
                              title={kidNames || 'No children available'}
                              className={`w-full min-h-12 rounded transition-all ${
                                available
                                  ? 'ring-2 ring-purple-600 ring-offset-1'
                                  : ''
                              } ${colorClass} hover:opacity-80 relative p-1 flex items-center justify-center`}
                            >
                              {availableKids.length > 0 && (
                                <span className="text-xs font-medium text-gray-800 text-center leading-tight">
                                  {kidNames}
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
              <p>Add a child to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
