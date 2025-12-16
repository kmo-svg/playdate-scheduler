import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vvvywjhaeaujpgqoqiyq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnl3amhhZWF1anBncW9xaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4OTM2MjYsImV4cCI6MjA4MTQ2OTYyNn0.y_6XLbHz6kanYStUFgkpPw_I5eZ0Tc_gFDD0BLTFPpo'

export const supabase = createClient(supabaseUrl, supabaseKey)
