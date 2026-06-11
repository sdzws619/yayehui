// Supabase 初始化 — 雅业会平台
// 此文件由 admin.html 和 yayehui.html 共享

var SUPABASE_URL = 'https://wrodvjsbdrxunaiwoaml.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb2R2anNiZHJ4dW5haXdvYW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTg1OTYsImV4cCI6MjA5NTA5NDU5Nn0.fQF-gyK53zsaqyojHxXrCBR5lZ6Ioib4rNvgPZ4J4Ww';

var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var USE_SUPABASE = true;
