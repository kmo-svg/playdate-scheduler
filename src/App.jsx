import React, { useState, useEffect } from 'react';
import { Calendar, Users, Settings, X } from 'lucide-react';

const App = () => {
  const [childName, setChildName] = useState('');
  const [children, setChildren] = useState([]);
  const [currentChild, setCurrentChild] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dateRange, setDateRange] = useState([]);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

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

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load children
      const childrenResult = await window.storage.get('playdate-children', true);
      if (childrenResult) {
        const loadedChildren = JSON.parse(childrenResult.value);
        setChildren(loadedChildren);
      }

      // Load date range
      const dateRangeResult = await window.storage.get('playdate-dates', true);
      if (dateRangeResult) {
        const dates = JSON.parse(dateRangeResult.value);
        setDateRange(dates);
      } else {
        // Default to next 7 days
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          dates.push(date.toISOString().split('T')[0]);
        }
        setDateRange(dates);
        await window.storage.set('playdate-dates', JSON.stringify(dates), true);
      }
    } catch (error) {
      console.log('First time setup - no existing data');
      // Set default date range for first time
      const today = new Date();
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      setDateRange(dates);
    } finally {
      setLoading(false);
    }
  };

  const saveChildren = async (updatedChildren) => {
    try {
      await window.storage.set('playdate-children', JSON.stringify(updatedChildren), true);
    } catch (error) {
      console.error('Error saving children:', error);
      alert('Failed to save data. Please try again.');
    }
  };

  const addChild = async () => {
    if (childName.trim()) {
      const newChild = {
        id: Date.now(),
        name: childName.trim(),
        availability: {}
      };
      const updatedChildren = [...children, newChild];
      setChildren(updatedChildren);
      setCurrentChild(newChild);
      setChildName('');
      setShowNameInput(false);
      await saveChildren(updatedChildren);
    }
  };

  const toggleSlot = async (date, time) => {
    if (!currentChild) return;
    
    const updatedChildren = children.map(c => {
      if (c.id === currentChild.id) {
        const key = `${date}-${time}`;
        const newAvailability = { ...c.availability };
        if (newAvailability[key]) {
          delete newAvailability[key];
        } else {
          newAvailability[key] = true;
        }
        const updated = { ...c, availability: newAvailability };
        setCurrentChild(updated);
        return updated;
      }
      return c;
    });
    
    setChildren(updatedChildren);
    await saveChildren(updatedChildren);
  };

  const getAvailableChildren = (date, time) => {
    const key = `${date}-${time}`;
    return children.filter(c => c.availability[key]);
  };

  const getSlotColor = (date, time) => {
    const availableKids = getAvailableChildren(date, time);
    return availableKids.length > 0 ? 'bg-green-400' : 'bg-gray-100';
  };

  const isCurrentChildAvailable = (date, time) => {
    if (!currentChild) return false;
    const key = `${date}-${time}`;
    return currentChild.availability[key];
  };

  const switchChild = (child) => {
    setCurrentChild(child);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getBestTimes = () => {
    const slotCounts = [];
    dateRange.forEach(date => {
      timeSlots.forEach(slot => {
        const availableKids = getAvailableChildren(date, slot.time);
        if (availableKids.length > 0) {
          slotCounts.push({ 
            date,
            time: slot.display, 
            count: availableKids.length,
            names: availableKids.map(k => k.name).join(', ')
          });
        }
      });
    });
    return slotCounts.sort((a, b) => b.count - a.count).slice(0, 5);
  };

  const saveDateRange = async () => {
    if (!tempStartDate || !tempEndDate) {
      alert('Please select both start and end dates');
      return;
    }

    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);
    
    if (start > end) {
      alert('Start date must be before end date');
      return;
    }

    const dates = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    setDateRange(dates);
    await window.storage.set('playdate-dates', JSON.stringify(dates), true);
    setShowSettings(false);
    setTempStartDate('');
    setTempEndDate('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Play Date Scheduler</h1>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Date Range Settings</h2>
                  <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={tempStartDate}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={tempEndDate}
                      onChange={(e) => setTempEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={saveDateRange}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    Save Date Range
                  </button>
                </div>
              </div>
            </div>
          )}

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
                <button
                  onClick={() => setShowNameInput(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNameInput(true)}
                className="mb-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
              >
                + Add Child
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

          {children.length > 0 && getBestTimes().length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Top Available Times</h3>
              <div className="space-y-1">
                {getBestTimes().map((slot, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    <span className="font-medium">{formatDate(slot.date)} {slot.time}</span> - {slot.names}
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
                    {dateRange.map(date => (
                      <th key={date} className="p-2 text-center font-semibold text-gray-700 border-b-2 border-purple-300 min-w-[120px]">
                        {formatDate(date)}
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
                      {dateRange.map(date => {
                        const available = isCurrentChildAvailable(date, slot.time);
                        const colorClass = getSlotColor(date, slot.time);
                        const availableKids = getAvailableChildren(date, slot.time);
                        const kidNames = availableKids.map(k => k.name).join(', ');
                        
                        return (
                          <td key={date} className="p-1 border-b border-gray-200">
                            <button
                              onClick={() => toggleSlot(date, slot.time)}
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
