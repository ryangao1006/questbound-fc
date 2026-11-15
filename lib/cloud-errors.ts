const messages:Record<string,[string,string]>={
 ACCOUNT_NOT_CONFIGURED:['Microsoft / OneDrive setup is not complete. Your local changes are kept.','Microsoft／OneDrive 尚未接通，本机修改会保留。'],
 AUTH_REQUIRED:['Sign in with Microsoft to resume cloud sync. Local changes are kept.','请使用 Microsoft 登录以继续云端同步，本机修改会保留。'],
 ACCOUNT_CHANGED:['The signed-in account changed in another tab. Reload to switch; saved changes stay in their original account.','其他标签页更换了登录账户。请刷新后切换，已保存的修改仍属于原账户。'],
 CLOUD_CONFLICT:['OneDrive changed on another device. Review the saved versions before syncing.','其他设备修改了 OneDrive 资料，请检查保存的版本后同步。'],
 CLOUD_PENDING_COMMIT:['An earlier cloud upload needs recovery. Your local changes are kept.','较早的云端上传需要处理，本机修改会保留。'],
 CLOUD_HEAD_MISSING_OR_REGRESSED:['Previously saved cloud records are missing or older. Restore a verified backup; local changes are kept.','已保存的云端资料缺失或版本倒退。请恢复经过验证的备份，本机修改会保留。'],
 CLOUD_CHECKSUM_MISMATCH:['Cloud verification failed. Previous recovery copies and local changes are kept.','云端校验失败，原恢复副本与本机修改会保留。'],
 CLOUD_SCHEMA_UNSUPPORTED:['Update the app before opening this newer cloud data.','请先更新网站，再打开这个较新的云端资料版本。'],
 TODOIST_RECONNECT:['Reconnect Todoist. Your tasks and waiting changes are kept.','请重新连接 Todoist，任务与待同步修改会保留。'],
 TODOIST_UNAVAILABLE:['Todoist is unavailable. Changes remain queued for retry.','暂时无法连接 Todoist，修改会保留并等待重试。'],
 TODOIST_COMMAND_REJECTED:['Todoist did not accept a queued change. Review the connection; the change is kept.','Todoist 未接受一项待同步修改。请检查连接，修改会保留。'],
 INTEGRATIONS_PAUSED:['Connections are paused after restoration. Review and resume them in Settings.','恢复后外部连接已暂停，请在设置中检查并恢复同步。'],
 NETWORK_UNAVAILABLE:['Network unavailable. Saved changes remain on this device.','网络暂时不可用，已保存的修改仍在此设备。'],
};
export function cloudErrorMessage(code:unknown,fallback:string,language:'en'|'zh'='en'){const pair=messages[String(code)];return pair?pair[language==='zh'?1:0]:fallback}
