# Analysis_Bot
Discord Analysis Bot

# Info
Analyze users online, offline, AFK in voice channels.

# How to use
```
1. Edit config.json.example and rename it config.json.
2. npm install
3. node dist
```

# Command
The default prefix is `?`.  
You can modify it from config.example.json.

- `?get [day|month] <userID>`  
  - Get user online offline data.
- `?rank [on|off]`
  - Switch rank display.
  - Only administrator or add userID to admin in config.example.json.
  - The default value is off

# Rank
Daily midnight sent yesterday's online time ranking.  
Send to the channel where the ranking instruction was sent.

# Web
Web on `localhost` and port is `8787`.

- `/api/day/:serverID` 
  - Get server today data
- `/api/month/:serverID`
  - Get server month data
- `/api/all/:serverID`
  - Get server all data

# Todo
- [x] ~~Web pages~~
- [ ] Predicting user status (delay)
- [x] ~~Web backend~~
- [x] ~~Command~~
- [x] ~~Rank~~
