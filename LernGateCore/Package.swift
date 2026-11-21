// swift-tools-version:5.8
import PackageDescription

let package = Package(
    name: "LernGateCore",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "LernGateCore", targets: ["LernGateCore"])
    ],
    targets: [
        .target(name: "LernGateCore"),
        .testTarget(name: "LernGateCoreTests", dependencies: ["LernGateCore"])
    ]
)
