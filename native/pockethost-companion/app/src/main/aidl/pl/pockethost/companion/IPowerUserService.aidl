package pl.pockethost.companion;

interface IPowerUserService {
    void destroy() = 16777114;
    String readCpuAndProcesses() = 2;
    String readInstalledPackages() = 3;
}
