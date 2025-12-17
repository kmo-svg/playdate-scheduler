import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Settings, X, ChevronLeft, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

const App = () => {
  const [childName, setChildName] = useState('');
  const [childPhone, setChildPhone] = useState('');
  const [children, setChildren] = useState([]);
  const [currentChild, setCurrentChild] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [showEditChild, setShowEditChild] = useState(null);
  const [editingChildName, setEditingChildName] = useState('');
  const [editingChildPhone, setEditingChildPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dateRange, setDateRange] = useState([]);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const scrollContainerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [touchMoved, setTouchMoved] = useState(false);
  const [pendingClipboardData, setPendingClipboardData] = useState(null);

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

  useEffect(() => {
    loadData();
    
    const channel = supabase
      .channel('playdate_changes')
      .on('postgres_changes', 
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
      
      const { data: childrenData, error: childrenError } = await supabase
        .from('playdate_data')
        .select('value')
        .eq('key', 'children')
        .single();

      if (!childrenError && childrenData) {
        setChildren(JSON.parse(childrenData.value));
      }

      const { data: dateData, error: dateError } = await supabase
        .from('playdate_data')
        .select('value')
        .eq('key', 'dates')
        .single();

      if (!dateError && dateData) {
        setDateRange(JSON.parse(dateData.value));
      } else {
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          dates.push(date.toISOString().split('T')[0]);
        }
        setDateRange(dates);
        await supabase.from('playdate_data').upsert({ key: 'dates', value: JSON.stringify(dates) });
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
      
      const { data: existing } = await supabase
        .from('playdate_data')
        .select('id')
        .eq('key', 'children')
        .single();

      let result;
      if (existing) {
        result = await supabase
          .from('playdate_data')
          .update({ value: JSON.stringify(updatedChildren) })
          .eq('key', 'children');
      } else {
        result = await supabase
          .from('playdate_data')
          .insert({ key: 'children', value: JSON.stringify(updatedChildren) });
      }
      
      if (result.error) {
        console.error('Supabase error details:', result.error);
        throw result.error;
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving children:', error);
      setSaveStatus('');
      alert(`Failed to save data: ${error.message || 'Please check console for details'}`);
    }
  };

  const deleteChild = async (childId) => {
    if (!confirm('Are you sure you want to remove this child and all their availability?')) {
      return;
    }

    const updatedChildren = children.filter(c => c.id !== childId);
    setChildren(updatedChildren);
    
    if (currentChild?.id === childId) {
      setCurrentChild(null);
    }
    
    await saveChildren(updatedChildren);
  };

  const handleChildClick = (child) => {
    switchChild(child);
  };

  const handleChildContextMenu = (e, child) => {
    e.preventDefault();
    setShowEditChild(child.id);
    setEditingChildName(child.name);
    setEditingChildPhone(child.phone || '');
  };

  const handleChildTouchStart = (child) => {
    setTouchMoved(false);
    longPressTimerRef.current = setTimeout(() => {
      setShowEditChild(child.id);
      setEditingChildName(child.name);
      setEditingChildPhone(child.phone || '');
    }, 500);
  };

  const handleChildTouchMove = () => {
    setTouchMoved(true);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleChildTouchEnd = (child) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (!touchMoved) {
      switchChild(child);
    }
  };

  const toggleAllSlotsForDay = async (date) => {
    if (!currentChild) return;
    
    const allSlotsSelected = timeSlots.every(slot => {
      const key = `${date}-${slot.time}`;
      return currentChild.availability[key];
    });
    
    const updatedChildren = children.map(c => {
      if (c.id === currentChild.id) {
        const newAvailability = { ...c.availability };
        
        timeSlots.forEach(slot => {
          const key = `${date}-${slot.time}`;
          if (allSlotsSelected) {
            delete newAvailability[key];
          } else {
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
    return timeSlots.every(slot => {
      const key = `${date}-${slot.time}`;
      return currentChild.availability[key];
    });
  };

  const scrollSchedule = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const addChild = async () => {
    if (!childName.trim()) {
      alert('Please enter a child name');
      return;
    }
    
    if (!childPhone.trim()) {
      alert('Phone number is required');
      return;
    }
    
    const newChild = {
      id: Date.now().toString(),
      name: childName.trim(),
      phone: childPhone.trim(),
      availability: {}
    };
    
    const updatedChildren = [...children, newChild];
    setChildren(updatedChildren);
    setChildName('');
    setChildPhone('');
    setShowNameInput(false);
    setCurrentChild(newChild);
    
    await saveChildren(updatedChildren);
  };

  const updateChild = async (childId, newName, newPhone) => {
    if (!newName.trim()) {
      alert('Child name cannot be empty');
      return;
    }
    
    if (!newPhone.trim()) {
      alert('Phone number is required');
      return;
    }
    
    const updatedChildren = children.map(c => {
      if (c.id === childId) {
        const updated = { ...c, name: newName.trim(), phone: newPhone.trim() };
        if (currentChild?.id === childId) {
          setCurrentChild(updated);
        }
        return updated;
      }
      return c;
    });
    
    setChildren(updatedChildren);
    setShowEditChild(null);
    setEditingChildName('');
    setEditingChildPhone('');
    await saveChildren(updatedChildren);
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
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const findConsecutiveTimeRange = (date, clickedTime) => {
    const availableKids = getAvailableChildren(date, clickedTime);
    if (availableKids.length < 2) return null;

    const otherKids = availableKids.filter(k => k.id !== currentChild?.id);
    const otherKidIds = otherKids.map(k => k.id).sort();

    if (otherKidIds.length === 0) return null;

    const clickedIndex = timeSlots.findIndex(s => s.time === clickedTime);
    let startIndex = clickedIndex;
    let endIndex = clickedIndex;

    for (let i = clickedIndex - 1; i >= 0; i--) {
      const kids = getAvailableChildren(date, timeSlots[i].time);
      const theseOtherKids = kids.filter(k => k.id !== currentChild?.id);
      const theseKidIds = theseOtherKids.map(k => k.id).sort();
      
      const currentChildAvailable = kids.some(k => k.id === currentChild?.id);
      if (otherKidIds.every(id => theseKidIds.includes(id)) && currentChildAvailable) {
        startIndex = i;
      } else {
        break;
      }
    }

    for (let i = clickedIndex + 1; i < timeSlots.length; i++) {
      const kids = getAvailableChildren(date, timeSlots[i].time);
      const theseOtherKids = kids.filter(k => k.id !== currentChild?.id);
      const theseKidIds = theseOtherKids.map(k => k.id).sort();
      
      const currentChildAvailable = kids.some(k => k.id === currentChild?.id);
      if (otherKidIds.every(id => theseKidIds.includes(id)) && currentChildAvailable) {
        endIndex = i;
      } else {
        break;
      }
    }

    const endSlotTime = timeSlots[endIndex].time;
    const [hours, minutes] = endSlotTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + 30);
    const endTimeDisplay = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return {
      startTime: timeSlots[startIndex].display,
      endTime: endTimeDisplay,
      children: otherKids
    };
  };

  // NEW APPROACH: Use a custom modal that copies when user clicks a button
  const handleSlotContextMenu = (e, date, time) => {
    e.preventDefault();
    
    if (!currentChild || !isCurrentChildAvailable(date, time)) {
      alert('You can only create a group text for time slots when your child is available.');
      return;
    }
    
    const availableKids = getAvailableChildren(date, time);
    
    if (availableKids.length < 2) {
      alert('Need at least 2 children available to create a group text');
      return;
    }

    const timeRange = findConsecutiveTimeRange(date, time);
    if (!timeRange) return;

    const otherKidsWithPhones = timeRange.children.filter(c => c.phone);
    
    if (otherKidsWithPhones.length === 0) {
      alert('No phone numbers available for the other children. Add phone numbers first!');
      return;
    }

    const message = `Hi all! The play date scheduler shows that our kids are all available from ${timeRange.startTime}-${timeRange.endTime} on ${formatDateFull(date)}. Let me know if that timeframe still works for everyone & we can set something up.`;
    
    const phoneNumbersOnly = otherKidsWithPhones.map(c => c.phone).join(', ');
    const phoneList = otherKidsWithPhones.map(c => `${c.name}: ${c.phone}`).join('\n');
    
    // Store data and show modal
    setPendingClipboardData({
      message,
      phoneNumbersOnly,
      phoneList,
      otherKidsWithPhones
    });
  };

  const handleSlotTouchStart = (date, time) => {
    const touchTimer = setTimeout(() => {
      handleSlotContextMenu({ preventDefault: () => {} }, date, time);
    }, 500);
    
    return touchTimer;
  };

  const copyAndOpenSMS = async () => {
    if (!pendingClipboardData) return;

    const { message, phoneNumbersOnly } = pendingClipboardData;
    
    // Try to copy using multiple methods
    let success = false;
    
    // Method 1: Modern Clipboard API
    try {
      await navigator.clipboard.writeText(phoneNumbersOnly);
      success = true;
      console.log('Clipboard API succeeded');
    } catch (err) {
      console.log('Clipboard API failed:', err);
    }
    
    // Method 2: execCommand fallback
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = phoneNumbersOnly;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
        console.log('execCommand result:', success);
      } catch (err) {
        console.log('execCommand failed:', err);
      }
    }
    
    // Close modal
    setPendingClipboardData(null);
    
    // Open SMS app
    window.location.href = 'sms:?body=' + encodeURIComponent(message);
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
    await supabase.from('playdate_data').upsert({ key: 'dates', value: JSON.stringify(dates) });
    setShowSettings(false);
    setTempStartDate('');
    setTempEndDate('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-xl text-purple-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-800">Play Date Scheduler</h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors opacity-30 hover:opacity-60"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {showSettings && (
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Date Range Settings</h3>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={saveDateRange}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Update Range
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-800">Children</h2>
            </div>
            
            {showNameInput ? (
              <div className="flex gap-2 mb-3 flex-wrap">
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChild()}
                  placeholder="Child's name"
                  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <input
                  type="tel"
                  value={childPhone}
                  onChange={(e) => setChildPhone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addChild()}
                  placeholder="Phone (required)"
                  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={addChild}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNameInput(false);
                    setChildName('');
                    setChildPhone('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNameInput(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium mb-3"
              >
                + Add Child
              </button>
            )}

            <div className="flex gap-2 flex-wrap">
              {children.map(child => (
                <button
                  key={child.id}
                  onClick={() => handleChildClick(child)}
                  onContextMenu={(e) => handleChildContextMenu(e, child)}
                  onTouchStart={() => handleChildTouchStart(child)}
                  onTouchMove={() => handleChildTouchMove()}
                  onTouchEnd={() => handleChildTouchEnd(child)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentChild?.id === child.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-600 border border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {child.name}
                  {child.phone && <Phone className="inline w-3 h-3 ml-1" />}
                </button>
              ))}
            </div>

            {showEditChild && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl p-6 max-w-sm w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Edit Child</h3>
                    <button onClick={() => {
                      setShowEditChild(null);
                      setEditingChildName('');
                      setEditingChildPhone('');
                    }} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Child's Name</label>
                      <input
                        type="text"
                        value={editingChildName}
                        onChange={(e) => setEditingChildName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && updateChild(showEditChild, editingChildName, editingChildPhone)}
                        placeholder="Child's name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={editingChildPhone}
                        onChange={(e) => setEditingChildPhone(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && updateChild(showEditChild, editingChildName, editingChildPhone)}
                        placeholder="Phone number (required)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => updateChild(showEditChild, editingChildName, editingChildPhone)}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Save Changes
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowEditChild(null);
                        setEditingChildName('');
                        setEditingChildPhone('');
                        deleteChild(showEditChild);
                      }}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Delete Child
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentChild && (
              <p className="mt-3 text-sm text-gray-600">
                Currently editing: <span className="font-semibold">{currentChild.name}</span>
                <span className="ml-2 text-gray-500">(Right-click or long-press a child's name to edit)</span>
              </p>
            )}
          </div>

          {currentChild && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Click on time slots below to mark when <strong>{currentChild.name}</strong> is available. 
                <span className="text-yellow-600 font-semibold"> Yellow = 1 child</span>, 
                <span className="text-green-600 font-semibold"> Green = 2+ children</span>. 
                <MessageCircle className="inline w-4 h-4 mx-1" />
                <span className="font-semibold">Right-click or long-press green slots to create a group text!</span>
              </p>
            </div>
          )}

          {currentChild ? (
            <div className="relative">
              <div className="h-12 flex justify-center items-center mb-2">
                {saveStatus && (
                  <span className={`text-sm px-4 py-2 rounded-full shadow-md transition-all ${
                    saveStatus === 'saving' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    {saveStatus === 'saving' ? 'Saving...' : '✓ Saved'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => scrollSchedule('left')}
                  className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                  title="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5 text-purple-700" />
                </button>
                <div className="flex-1 text-center text-sm text-gray-600">
                  Use arrow buttons or swipe to navigate dates
                </div>
                <button
                  onClick={() => scrollSchedule('right')}
                  className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                  title="Scroll right"
                >
                  <ChevronRight className="w-5 h-5 text-purple-700" />
                </button>
              </div>
              
              <div ref={scrollContainerRef} className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-white">
                  <tr>
                    <th className="sticky left-0 z-30 bg-white p-2 text-left font-semibold text-gray-700 border-b-2 border-purple-300 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                      Time
                    </th>
                    {dateRange.map(date => (
                      <th key={date} className="p-2 border-b-2 border-purple-300 min-w-[120px]">
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
                  {timeSlots.map(slot => (
                    <tr key={slot.time} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white p-2 text-sm font-medium text-gray-600 border-b border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                        {slot.display}
                      </td>
                      {dateRange.map(date => {
                        const available = isCurrentChildAvailable(date, slot.time);
                        const colorClass = getSlotColor(date, slot.time);
                        const availableKids = getAvailableChildren(date, slot.time);
                        const kidNames = availableKids.map(k => k.name).join(', ');
                        let slotTouchTimer = null;
                        
                        return (
                          <td key={date} className="p-1 border-b border-gray-200">
                            <button
                              onClick={() => toggleSlot(date, slot.time)}
                              onContextMenu={(e) => handleSlotContextMenu(e, date, slot.time)}
                              onTouchStart={() => { slotTouchTimer = handleSlotTouchStart(date, slot.time); }}
                              onTouchEnd={() => clearTimeout(slotTouchTimer)}
                              onTouchMove={() => clearTimeout(slotTouchTimer)}
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
                              {availableKids.length >= 2 && (
                                <MessageCircle className="absolute top-1 right-1 w-3 h-3 text-purple-700" />
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
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>Add a child to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM MODAL FOR CLIPBOARD */}
      {pendingClipboardData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Send Group Text</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Recipients:</p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                {pendingClipboardData.phoneList}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Instructions:</p>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>Click "Copy & Open Messages" below</li>
                <li>Phone numbers will be copied to clipboard</li>
                <li>Messages app will open with pre-filled text</li>
                <li>Paste the phone numbers into the recipient field</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyAndOpenSMS}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-base"
              >
                📋 Copy & Open Messages
              </button>
              <button
                onClick={() => setPendingClipboardData(null)}
                className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
              Phone numbers: {pendingClipboardData.phoneNumbersOnly}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
