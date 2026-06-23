{
    "targets": [
        {
            "target_name": "translation",
            "conditions": [
                [
                    "OS=='mac'",
                    {
                        "sources": ["translation.mm"],
                        "libraries": ["-framework Cocoa", "-framework AppKit"],
                        "xcode_settings": {
                            "CLANG_ENABLE_OBJC_ARC": "YES",
                            "MACOSX_DEPLOYMENT_TARGET": "11.0",
                            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"]
                        }
                    }
                ]
            ]
        }
    ]
}
