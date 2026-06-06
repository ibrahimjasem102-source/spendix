package com.spendix.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onStart() {
    super.onStart();
    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
  }
}
