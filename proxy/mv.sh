cp -r contracts contracts1
git checkout 1.1.3-beta.0
rsync -av contracts1/ contracts/ && rm -r contracts1
