!macro customInstall
  CreateDirectory "$DESKTOP"
  CreateShortCut "$DESKTOP\小黄的工作站.lnk" "$INSTDIR\小黄的工作站.exe" "" "$INSTDIR\小黄的工作站.exe" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\小黄的工作站.lnk"
!macroend
