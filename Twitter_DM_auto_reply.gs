//Twitter DeveloperのConsumer API KeyとConsumer API Secret
let VAL_CONSUMER_API_KEY     = '';
let VAL_CONSUMER_API_SECRET  = '';
var count = '10'
var userid = '';  //twitterアカウントの@以下の文字列
var subtext = '';  //見つからなかった時の言葉

//認証を実行する関数
function logOAuthURL() {
var twitterService = getTwitterService();
  Logger.log(twitterService.authorize());
}
// OAuth1.0の認証で、Twitterにアクセスする関数
function getTwitterService() {
// Create a new service with the given name. The name will be used when
// persisting the authorized token, so ensure it is unique within the
// scope of the property store.
return OAuth1.createService('twitter')
    // Set the endpoint URLs.
    .setAccessTokenUrl('https://api.twitter.com/oauth/access_token')
    .setRequestTokenUrl('https://api.twitter.com/oauth/request_token')
    .setAuthorizationUrl('https://api.twitter.com/oauth/authorize')
    // Set the consumer key and secret.
    .setConsumerKey(VAL_CONSUMER_API_KEY)
    .setConsumerSecret(VAL_CONSUMER_API_SECRET)
    // Set the name of the callback function in the script referenced
    // above that should be invoked to complete the OAuth flow.
    .setCallbackFunction('authCallback')
    // Set the property store where authorized tokens should be persisted.
    .setPropertyStore(PropertiesService.getUserProperties());
}

// 認証の確認後に表示する可否メッセージを指定する関数
function authCallback(request) {
  var twitterService = getTwitterService();
  var isAuthorized = twitterService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}
//userIDを検索する関数
function getUserId() {
  try {
    var twitterService = getTwitterService();
     
    if (!twitterService.hasAccess()) {
      Logger.log(twitterService.getLastError());
      return null;
    }
    var url = "https://api.twitter.com/1.1/users/lookup.json?screen_name=" + userid
    var response = twitterService.fetch(url, {
    method: "get",
    contentType: 'application/json'
    });
    Logger.log(JSON.parse(response.getContentText())[0].id_str)
    return JSON.parse(response.getContentText())[0].id_str
  }
catch (ex) {
    Logger.log(ex)
    return null;
  }
}

//スプレッドシートから検索ワードを検索する関数
function searchWords(keys) {
  //検索ワードがスプレッドシートになかった時に出力するワード
  var sub_text = subtext;
  //検索ワード記入
  const searchWord = keys; //検索する言葉
  //スプレッドシートの情報を取得
  const sheet =  SpreadsheetApp.getActiveSpreadsheet();
  const keysArray = sheet.getRange("A:A").getValues().flat(); //二次元配列を一次元化
  const valuesArray = sheet.getRange("B:B").getValues().flat(); //二次元配列を一次元化
  const keysArrayLen = keysArray.length; //配列の長さを取得
 //配列内の要素を１つずつ取得し、一致するか検証
  for(var i=0; i<keysArrayLen; i++){
    const isExisted = keysArray[i].indexOf(searchWord, 0);
    if(isExisted != -1){
      return valuesArray[i];
    }
  }
  return sub_text;
}

//送られてきたDMを取得する関数
function getDmMedia(){
  try {
    var twitterService = getTwitterService();
    if (!twitterService.hasAccess()) {
      Logger.log(twitterService.getLastError());
      return null;
    }
    var url = 'https://api.twitter.com/1.1/direct_messages/events/list.json?count=' + count
    var response = twitterService.fetch(url, { method: "GET" });
    var json = JSON.parse(response); //DMをJSON形式で取得

    //スプレッドシートに書き込んだ前回の最後の応答を読み込み
    //シートを読み込み
    const sheet =  SpreadsheetApp.getActiveSpreadsheet();
    // C2セルを選択
    var range = sheet.getRange('C2');
    // セルの値を取得
    var value = range.getValue();
    var userID = getUserId(userid)
    let array = [ ]
    var time_rec = value
    for(record = 0; record < json["events"].length; record++){
      //最近送信したor送信されたDMの送信時刻と送信者id、メッセージを取得
      var time = json["events"][record]["created_timestamp"]
      var senderID = json["events"][record]["message_create"]["sender_id"]
      var keys = json["events"][record]["message_create"]["message_data"]["text"]
      var dmtime = time/1000
      const jstTime = Utilities.formatDate(new Date(dmtime*1000), "JST", 'yyyy-MM-dd HH:mm:ss');
      if (senderID != userID & time > value){
        send_message = searchWords(keys)
        array.push({senderID, send_message, keys})
        time_rec = Math.max(time_rec, time)
        }
      }
    var set_values = range.setValue(time_rec);
    array = array.reverse();
    return array;
  }
  catch (ex) {
    Logger.log(ex);
    return null;
  }
}

//DMを返信する関数
function sendDM(_, userID, text){
  array = getDmMedia();
  if (array != null){
    for (record = 0; record < array.length; record++){
      const results = array[record];
      var userID = results["senderID"];
      var text = results["send_message"];
      
      try{
      
        var service = getTwitterService();
        var payload = JSON.stringify({
          event: {
            type: 'message_create',
            message_create: {
              target: {
                recipient_id: String(userID)
                },
              message_data: { text: text }
              }
            }
          });
        var response = service.fetch('https://api.twitter.com/1.1/direct_messages/events/new.json',{
          method: 'POST',
          contentType: 'application/json',
          payload: payload
        });
      } catch(e) {
        Logger.log('Exception:'+e);
      }
    }
    return response;
  }
}

//このプログラムを止める時に実行する
function resetTwitterService() {
  var twitterService = getTwitterService();
  twitterService.reset();
}