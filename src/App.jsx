import React, { useState, useEffect } from 'react';
import { Calendar, Users, Settings, X } from 'lucide-react';
import { supabase } from './supabaseClient';

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
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', or ''

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === 20 && min > 0) break;
        const time = `${hour.toString().padStart(2, '0')}:${min
          .toString()
          .padStart(2, '0')}`;
        const display = new Date(`2000-01-01T${time}`).toLocaleTimeString(
          'en-US',
          {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }
        );
        slots.push({ time, display });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    loadData();

    // Subscribe to changes
    const channel = supabase
      .channel('playdate_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playdate_data' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load children
      const { data: childrenData, error: childrenError } = await supabase
        .from('playdate_data')
        .select('value')
        .eq('key', 'children')
        .single();

      if (!childrenError && childrenData) {
        setChildren(JSON.parse(childrenData.value));
      }

      // Load date range
      const { data: dateData, error: dateError } = await supabase
        .from('playdate_data')
        .select('value')
        .eq('key', 'dates')
        .single();

      if (!dateError && dateData) {
        setDateRange(JSON.parse(dateData.value));
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
        await supabase
          .from('playdate_data')
          .upsert({ key: 'dates', value: JSON.stringify(dates) });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveChildren = async (updatedChildren) => {
    try {
      setSaveStatus('saving');

      // First check if record exists
      const { data: existing } = await supabase
        .from('playdate_data')
        .select('id')
        .eq('key', 'children')
        .single();

      let result;
      if (existing) {
        // Update existing record
        result = await supabase
          .from('playdate_data')
          .update({ value: JSON.stringify(updatedChildren) })
          .eq('key', 'children');
      } else {
        // Insert new record
        result = await supabase
          .from('playdate_data')
          .insert({ key: 'children', value: JSON.stringify(updatedChildren) });
      }

      if (result.error) {
        console.error('Supabase error details:', result.error);
        throw result.error;
      }
      console.log('Successfully saved children');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000); // Clear after 2 seconds
    } catch (error) {
      console.error('Error saving children:', error);
      setSaveStatus('');
      alert(
        `Failed to save data: ${
          error.message || 'Please check console for details'
        }`
      );
    }
  };

  const deleteChild = async (childId) => {
    if (
      !confirm(
        'Are you sure you want to remove this child and all their availability?'
      )
    ) {
      return;
    }

    const updatedChildren = children.filter((c) => c.id !== childId);
    setChildren(updatedChildren);

    if (currentChild?.id === childId) {
      setCurrentChild(null);
    }

    await saveChildren(updatedChildren);
  };

  const handleChildClick = (child) => {
    switchChild(child);
  };

  const handleChildContextMenu = (e, childId) => {
    e.preventDefault();
    deleteChild(childId);
  };

  const handleChildTouchStart = (childId) => {
    const touchTimer = setTimeout(() => {
      deleteChild(childId);
    }, 500); // 500ms long press

    return touchTimer;
  };

  const handleChildTouchEnd = (touchTimer) => {
    clearTimeout(touchTimer);
  };

  const toggleAllSlotsForDay = async (date) => {
    if (!currentChild) return;

    // Check if all slots for this day are already selected
    const allSlotsSelected = timeSlots.every((slot) => {
      const key = `${date}-${slot.time}`;
      return currentChild.availability[key];
    });

    const updatedChildren = children.map((c) => {
      if (c.id === currentChild.id) {
        const newAvailability = { ...c.availability };

        timeSlots.forEach((slot) => {
          const key = `${date}-${slot.time}`;
          if (allSlotsSelected) {
            // If all selected, deselect all
            delete newAvailability[key];
          } else {
            // Otherwise, select all
            newAvailability[key] = true;
          }
        });

        const updated = { ...c, availability: newAvailability };
        setCurrentChild(updated);
        return updated;
      }
      return c;
    });

    setChildren(updatedChildren);
    await saveChildren(updatedChildren);
  };

  const isAllDaySelected = (date) => {
    if (!currentChild) return false;
    return timeSlots.every((slot) => {
      const key = `${date}-${slot.time}`;
      return currentChild.availability[key];
    });
  };

  const addChild = async () => {
    if (childName.trim()) {
      const newChild = {
        id: Date.now(),
        name: childName.trim(),
        availability: {},
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

    const updatedChildren = children.map((c) => {
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
    return children.filter((c) => c.availability[key]);
  };

  const getSlotColor = (date, time) => {
    const availableKids = getAvailableChildren(date, time);
    if (availableKids.length === 0) return 'bg-gray-100';
    if (availableKids.length === 1) return 'bg-yellow-400';
    return 'bg-green-400';
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
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
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

    // Use same pattern as saveChildren
    try {
      const { data: existing } = await supabase
        .from('playdate_data')
        .select('id')
        .eq('key', 'dates')
        .single();

      let result;
      if (existing) {
        result = await supabase
          .from('playdate_data')
          .update({ value: JSON.stringify(dates) })
          .eq('key', 'dates');
      } else {
        result = await supabase
          .from('playdate_data')
          .insert({ key: 'dates', value: JSON.stringify(dates) });
      }

      if (result.error) throw result.error;
    } catch (error) {
      console.error('Error saving dates:', error);
      alert('Failed to save date range');
      return;
    }

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
              <h1 className="text-3xl font-bold text-gray-800">
                Play Date Scheduler
              </h1>
              {saveStatus && (
                <span
                  className={`text-sm px-3 py-1 rounded-full transition-all ${
                    saveStatus === 'saving'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Date Range Settings
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={tempStartDate}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
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
              {children.map((child) => {
                let touchTimer = null;

                return (
                  <button
                    key={child.id}
                    onClick={() => handleChildClick(child)}
                    onContextMenu={(e) => handleChildContextMenu(e, child.id)}
                    onTouchStart={() => {
                      touchTimer = handleChildTouchStart(child.id);
                    }}
                    onTouchEnd={() => handleChildTouchEnd(touchTimer)}
                    onTouchMove={() => handleChildTouchEnd(touchTimer)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentChild?.id === child.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-purple-600 border border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {child.name}
                  </button>
                );
              })}
            </div>

            {currentChild && (
              <p className="mt-3 text-sm text-gray-600">
                Currently editing:{' '}
                <span className="font-semibold">{currentChild.name}</span>
                <span className="ml-2 text-gray-500">
                  (Right-click or long-press to delete)
                </span>
              </p>
            )}
          </div>

          {currentChild && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Click on time slots below to mark when{' '}
                <strong>{currentChild.name}</strong> is available.
                <span className="text-yellow-600 font-semibold">
                  {' '}
                  Yellow = 1 child
                </span>
                ,
                <span className="text-green-600 font-semibold">
                  {' '}
                  Green = 2+ children
                </span>
                . Hover over a slot to see names.
              </p>
            </div>
          )}

          {currentChild ? (
            <div className="relative max-h-[600px] overflow-auto border border-gray-200 rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-30 bg-white p-2 text-left font-semibold text-gray-700 border-b-2 border-purple-300 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                      Time
                    </th>
                    {dateRange.map((date) => (
                      <th
                        key={date}
                        className="sticky top-0 z-20 bg-white p-2 border-b-2 border-purple-300 min-w-[120px]"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="text-center font-semibold text-gray-700">
                            {formatDate(date)}
                          </div>
                          <button
                            onClick={() => toggleAllSlotsForDay(date)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              isAllDaySelected(date)
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                          >
                            {isAllDaySelected(date) ? 'Clear All' : 'All Day'}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((slot) => (
                    <tr key={slot.time} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white p-2 text-sm font-medium text-gray-600 border-b border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                        {slot.display}
                      </td>
                      {dateRange.map((date) => {
                        const available = isCurrentChildAvailable(
                          date,
                          slot.time
                        );
                        const colorClass = getSlotColor(date, slot.time);
                        const availableKids = getAvailableChildren(
                          date,
                          slot.time
                        );
                        const kidNames = availableKids
                          .map((k) => k.name)
                          .join(', ');

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
