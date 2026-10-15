' Double-click to start the desktop pet without a console window.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run """" & dir & "\node_modules\electron\dist\electron.exe"" """ & dir & """", 0, False
